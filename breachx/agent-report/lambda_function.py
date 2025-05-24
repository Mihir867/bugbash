import os
import json
import boto3
import tempfile
import logging
from datetime import datetime
from fpdf import FPDF  # fpdf2 still uses the same import name
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END
from typing import TypedDict, List, Dict
import re

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize AWS clients
s3 = boto3.client('s3')

# Get environment variables - set these in Lambda configuration
GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY')
OUTPUT_BUCKET = os.environ.get('OUTPUT_BUCKET')

# Initialize Gemini AI
gemini = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    google_api_key=GOOGLE_API_KEY,
    temperature=0.2
)

# Define the state structure for our LangGraph
class State(TypedDict):
    input_bucket: str
    input_key_prefix: str
    report_files: Dict[str, str]  # Map of tool_name -> report_content
    analysis: Dict[str, str]      # Map of tool_name -> analysis
    summary: str
    output_key: str

# LangGraph Node Functions

def fetch_reports(state: State) -> State:
    """Fetch all report files from S3"""
    logger.info(f"Fetching reports from {state['input_bucket']}/{state['input_key_prefix']}")
    
    report_files = {}
    
    # List all objects under the input prefix
    response = s3.list_objects_v2(
        Bucket=state['input_bucket'],
        Prefix=state['input_key_prefix']
    )
    
    if 'Contents' in response:
        for item in response['Contents']:
            key = item['Key']
            # Look for report files in tool folders (both .txt and .json)
            if key.endswith('/report.txt') or key.endswith('/report.json'):
                # Extract tool name from path
                tool_name = key.split('/')[-2]
                
                # Download file content
                response = s3.get_object(Bucket=state['input_bucket'], Key=key)
                content = response['Body'].read().decode('utf-8')
                
                # Handle JSON format if needed
                if key.endswith('.json'):
                    try:
                        # Parse JSON and convert to a pretty-printed string for analysis
                        json_content = json.loads(content)
                        content = f"JSON REPORT FORMAT:\n{json.dumps(json_content, indent=2)}"
                        logger.info(f"Processed JSON report for tool: {tool_name}")
                    except json.JSONDecodeError as e:
                        logger.warning(f"Error parsing JSON for {tool_name}: {str(e)}")
                        # Still use the raw content if JSON parsing fails
                        content = f"UNPARSEABLE JSON REPORT:\n{content}"
                
                report_files[tool_name] = content
                logger.info(f"Found report for tool: {tool_name}")
    
    state['report_files'] = report_files
    return state

def analyze_reports(state: State) -> State:
    """Analyze each report with Gemini AI"""
    logger.info(f"Analyzing {len(state['report_files'])} reports")
    
    analysis = {}
    
    for tool_name, content in state['report_files'].items():
        logger.info(f"Analyzing report for {tool_name}")
        
        # Determine if this is a JSON or text report
        is_json = content.startswith("JSON REPORT FORMAT:")
        
        # Customize prompt based on the tool type
        if tool_name == "nmap":
            prompt = f"""
            You are a cybersecurity expert analyzing an Nmap scan report.
            Please analyze the following Nmap output and extract key findings about discovered hosts, 
            open ports, services, and potential vulnerabilities.
            
            REPORT:
            {content[:8000]}  # Increased limit for Nmap reports which can be verbose
            
            Provide a detailed analysis in the following format:
            1. Key Findings: (list major discoveries like number of hosts, critical open ports)
            2. Open Ports and Services: (list with service versions if available)
            3. Potential Vulnerabilities: (based on open services and versions)
            4. Security Recommendations: (actionable steps to address findings)
            5. Risk Assessment: (overall risk evaluation)
            """
        elif tool_name == "testssl" and is_json:
            prompt = f"""
            You are a cybersecurity expert analyzing a testssl.sh SSL/TLS scan report.
            Please analyze the following JSON output and extract key findings about SSL/TLS configuration,
            certificate issues, supported protocols, and vulnerabilities like Heartbleed, POODLE, etc.
            
            REPORT:
            {content[:8000]}
            
            Provide a detailed analysis in the following format:
            1. Key Findings: (certificate issues, protocol weaknesses)
            2. SSL/TLS Protocol Issues: (list insecure protocols enabled)
            3. Cipher Vulnerabilities: (weak ciphers, insecure configurations)
            4. Certificate Analysis: (validity, trust chain issues)
            5. Security Recommendations: (specific configuration changes needed)
            6. Risk Assessment: (overall SSL/TLS security posture)
            """
        elif tool_name == "trivy" and is_json:
            prompt = f"""
            You are a cybersecurity expert analyzing a Trivy vulnerability scanner report.
            Please analyze the following JSON output and extract key findings about container/system vulnerabilities,
            focusing on severity levels, vulnerable packages, and available fixes.
            
            REPORT:
            {content[:8000]}
            
            Provide a detailed analysis in the following format:
            1. Key Findings: (critical and high severity vulnerabilities)
            2. Vulnerability Breakdown: (count by severity level)
            3. Critical Vulnerabilities: (list most severe with CVE IDs)
            4. Affected Components: (key packages/libraries requiring updates)
            5. Remediation Actions: (specific update recommendations)
            6. Risk Assessment: (overall security posture based on findings)
            """
        elif tool_name == "ssfrmap":
            prompt = f"""
            You are a cybersecurity expert analyzing an SSRF vulnerability scan report.
            Please analyze the following output and extract key findings about Server-Side Request Forgery
            vulnerabilities, potentially exploitable endpoints, and security implications.
            
            REPORT:
            {content[:6000]}
            
            Provide a detailed analysis in the following format:
            1. Key Findings: (list discovered SSRF vulnerabilities)
            2. Vulnerable Endpoints: (list with vulnerability details)
            3. Potential Impact: (what could be exploited via these SSRF issues)
            4. Recommendations: (how to fix or mitigate these vulnerabilities)
            5. Risk Assessment: (overall risk of SSRF in the application)
            """
        else:
            # Generic prompt for other tools
            prompt = f"""
            You are a cybersecurity expert analyzing a security scan report from {tool_name}.
            Please analyze the following output and extract key findings, vulnerabilities, 
            and recommendations. Focus on severity levels, actionable insights, and potential risks.
            
            REPORT:
            {content[:6000]}  # Limiting characters to ensure it fits in context window
            
            Provide a detailed analysis in the following format:
            1. Key Findings: (list major discoveries)
            2. Vulnerabilities Identified: (list with severity)
            3. Recommendations: (actionable steps)
            4. Risk Assessment: (overall risk evaluation)
            """
        
        try:
            response = gemini.invoke(prompt)
            analysis[tool_name] = response.content
            logger.info(f"Successfully analyzed {tool_name} report")
        except Exception as e:
            logger.error(f"Error analyzing {tool_name} report: {str(e)}")
            analysis[tool_name] = f"ERROR ANALYZING REPORT: {str(e)}\n\nPlease check the raw data for this tool."
    
    state['analysis'] = analysis
    return state

def generate_summary(state: State) -> State:
    """Generate an overall summary of all findings"""
    logger.info("Generating comprehensive summary")
    
    # Check if we have any analyses to summarize
    if not state['analysis']:
        logger.warning("No tool analyses found to summarize")
        state['summary'] = "No security tool reports were found or successfully analyzed."
        return state
    
    # Create a combined analysis text for the AI with tool names
    tool_names = list(state['analysis'].keys())
    tool_list = ", ".join(tool_names)
    
    combined_analysis = "\n\n".join([
        f"=== {tool_name} ANALYSIS ===\n{analysis}" 
        for tool_name, analysis in state['analysis'].items()
    ])
    
    prompt = f"""
    You are a cybersecurity expert creating an executive summary of multiple security scan reports.
    The following analyses were generated from these tools: {tool_list}.
    
    Review the following analyses and create a comprehensive summary.
    
    {combined_analysis}
    
    Please provide:
    1. Executive Summary: Brief overview of the security posture
    2. Critical Findings: The most important discoveries across all tools
    3. Risk Analysis: Overall risk level and potential impact
    4. Consolidated Recommendations: Prioritized list of actions
    5. Tool-specific Insights: Brief summary of what each tool revealed
    
    Format this as a professional security report suitable for executives and technical teams.
    """
    
    try:
        response = gemini.invoke(prompt)
        state['summary'] = response.content
        logger.info("Successfully generated summary")
    except Exception as e:
        logger.error(f"Error generating summary: {str(e)}")
        # Create basic summary in case of error
        tool_summaries = []
        for tool, analysis in state['analysis'].items():
            # Get first few lines of each analysis
            lines = analysis.split('\n')
            short_summary = '\n'.join(lines[:5]) + '...'
            tool_summaries.append(f"## {tool} Summary\n{short_summary}")
        
        state['summary'] = "# Security Analysis Summary\n\n" + \
                          "Error generating comprehensive summary. Please review individual tool analyses.\n\n" + \
                          "\n\n".join(tool_summaries)
    
    return state

def sanitize_text_for_pdf(text):
    """Sanitize text to prevent FPDF errors"""
    if not text:
        return ""
    
    # Remove any non-printable characters
    text = re.sub(r'[^\x20-\x7E\n\r\t]', '', text)
    
    # Break extremely long words that might cause layout issues
    words = text.split()
    processed_words = []
    
    for word in words:
        # If word is too long, break it into chunks
        if len(word) > 30:  # Threshold for "too long"
            chunks = [word[i:i+30] for i in range(0, len(word), 30)]
            processed_words.extend(chunks)
        else:
            processed_words.append(word)
    
    return ' '.join(processed_words)

def safe_multi_cell(pdf, w, h, txt, border=0, align='J', fill=False):
    """Safely add a multi-cell to the PDF, handling errors"""
    txt = sanitize_text_for_pdf(txt)
    
    # Split text into smaller chunks that are guaranteed to fit
    chunks = [txt[i:i+200] for i in range(0, len(txt), 200)]
    
    for chunk in chunks:
        try:
            pdf.multi_cell(w, h, chunk, border, align, fill)
        except Exception as e:
            logger.warning(f"Error in PDF generation: {str(e)}")
            # If still having issues, add word by word
            for word in chunk.split():
                try:
                    pdf.write(h, word + " ")
                except:
                    # Skip problematic words
                    continue
            pdf.ln(h)

def create_pdf(state: State) -> State:
    """Create a PDF report"""
    logger.info("Creating PDF report")
    
    # Generate timestamp for the filename
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    report_filename = f"security-summary-{timestamp}.pdf"
    state['output_key'] = f"reports/{timestamp}/{report_filename}"
    
    # Create PDF with wider margins to prevent the error
    pdf = FPDF(format='A4')
    pdf.set_auto_page_break(auto=True, margin=20)  # Increased margin
    
    # Add first page
    pdf.add_page()
    
    # Set wider margins to prevent text overflow
    pdf.set_left_margin(20)  # Increased from 10
    pdf.set_right_margin(20)  # Increased from 10
    
    # Add title
    pdf.set_font("Arial", "B", 16)
    pdf.cell(0, 10, "Security Scan Summary Report", ln=True, align='C')
    pdf.ln(10)
    
    # Add date and time
    pdf.set_font("Arial", "I", 10)
    pdf.cell(0, 10, f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", ln=True)
    pdf.ln(10)
    
    # Add summary content
    pdf.set_font("Arial", "", 11)
    
    # Break the summary into lines and add to PDF
    summary_lines = state['summary'].split('\n')
    for line in summary_lines:
        if line.strip():
            # Check if line is a header
            if line.startswith('#') or line.startswith('=='):
                pdf.set_font("Arial", "B", 12)
                pdf.ln(5)
                # Ensure line isn't too long
                header_text = line.replace('#', '').replace('=', '').strip()
                pdf.cell(0, 10, header_text[:80], ln=True)  # Shortened max length
                pdf.set_font("Arial", "", 11)
            else:
                # Use our safe multi_cell function
                safe_multi_cell(pdf, 0, 5, line)
        else:
            pdf.ln(3)
    
    pdf.ln(10)
    
    # Add individual tool analyses
    pdf.add_page()
    pdf.set_font("Arial", "B", 14)
    pdf.cell(0, 10, "Detailed Tool Analysis", ln=True)
    pdf.ln(5)
    
    for tool_name, analysis in state['analysis'].items():
        pdf.set_font("Arial", "B", 12)
        pdf.cell(0, 10, f"{tool_name} Analysis", ln=True)
        pdf.ln(3)
        
        pdf.set_font("Arial", "", 11)
        analysis_lines = analysis.split('\n')
        for line in analysis_lines:
            if line.strip():
                if line.startswith('#') or line.startswith('==='):
                    pdf.set_font("Arial", "B", 11)
                    pdf.ln(3)
                    header_text = line.replace('#', '').replace('=', '').strip()
                    pdf.cell(0, 10, header_text[:80], ln=True)  # Shortened max length
                    pdf.set_font("Arial", "", 11)
                else:
                    # Use our safe multi_cell function
                    safe_multi_cell(pdf, 0, 5, line)
            else:
                pdf.ln(3)
        
        pdf.ln(10)
    
    # Save PDF to temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
        temp_path = tmp.name
        try:
            pdf.output(temp_path)
        except Exception as e:
            logger.error(f"Error generating PDF: {str(e)}")
            # Create a simple error report instead
            pdf = FPDF(format='A4')
            pdf.add_page()
            pdf.set_left_margin(20)
            pdf.set_right_margin(20)
            pdf.set_font("Arial", "B", 16)
            pdf.cell(0, 10, "Error Generating Security Report", ln=True, align='C')
            pdf.ln(10)
            pdf.set_font("Arial", "", 12)
            pdf.cell(0, 10, "There was an error generating the full report.", ln=True)
            pdf.ln(5)
            pdf.cell(0, 10, "Please check Lambda logs for details.", ln=True)
            pdf.output(temp_path)
    
    # Upload PDF to output bucket
    try:
        s3.upload_file(
            temp_path,
            OUTPUT_BUCKET,
            state['output_key'],
            ExtraArgs={'ContentType': 'application/pdf'}
        )
        logger.info(f"PDF report uploaded to {OUTPUT_BUCKET}/{state['output_key']}")
    finally:
        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)
    
    return state

# Define the LangGraph
def build_graph():
    """Build the LangGraph workflow"""
    graph = StateGraph(State)
    
    # Add nodes
    graph.add_node("fetch_reports", fetch_reports)
    graph.add_node("analyze_reports", analyze_reports)
    graph.add_node("generate_summary", generate_summary)
    graph.add_node("create_pdf", create_pdf)
    
    # Connect nodes in sequence
    graph.add_edge("fetch_reports", "analyze_reports")
    graph.add_edge("analyze_reports", "generate_summary")
    graph.add_edge("generate_summary", "create_pdf")
    graph.add_edge("create_pdf", END)
    
    # Set entry point
    graph.set_entry_point("fetch_reports")
    
    return graph

# Lambda handler function
def lambda_handler(event, context):
    logger.info("Lambda function invoked")
    logger.info(f"Event: {json.dumps(event)}")
    
    try:
        # Process S3 event - assuming S3 trigger
        if 'Records' in event and len(event['Records']) > 0:
            # Extract unique timestamp folders from all records
            timestamp_folders = set()
            
            for record in event['Records']:
                if 'eventSource' in record and record['eventSource'] == 'aws:s3':
                    # Extract bucket and key
                    input_bucket = record['s3']['bucket']['name']
                    object_key = record['s3']['object']['key']
                    
                    # Get folder path 
                    key_parts = object_key.split('/')
                    if key_parts[-1] in ['report.txt', 'report.json']:
                        # Go one level up to get the timestamp folder
                        timestamp_folder = '/'.join(key_parts[:-2])
                        timestamp_folders.add((input_bucket, timestamp_folder))
            
            # Process each unique timestamp folder (typically will be just one)
            results = []
            for input_bucket, timestamp_folder in timestamp_folders:
                logger.info(f"Processing reports in {input_bucket}/{timestamp_folder}")
                
                # Initialize state
                initial_state = {
                    "input_bucket": input_bucket,
                    "input_key_prefix": timestamp_folder,
                    "report_files": {},
                    "analysis": {},
                    "summary": "",
                    "output_key": ""
                }
                
                # Build and run graph
                graph = build_graph()
                workflow = graph.compile()
                result = workflow.invoke(initial_state)
                results.append({
                    "timestamp_folder": timestamp_folder,
                    "output_key": result["output_key"]
                })
            
            return {
                "statusCode": 200,
                "body": json.dumps({
                    "message": f"Security report(s) generated successfully for {len(results)} timestamp folders",
                    "output_bucket": OUTPUT_BUCKET,
                    "results": results
                })
            }
        
        # If not an S3 event, handle manual invocation
        return {
            "statusCode": 400,
            "body": json.dumps({
                "message": "Lambda function requires S3 event trigger"
            })
        }
        
    except Exception as e:
        logger.error(f"Error: {str(e)}", exc_info=True)
        return {
            "statusCode": 500,
            "body": json.dumps({
                "message": f"Error: {str(e)}"
            })
        }