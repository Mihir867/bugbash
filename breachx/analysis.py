import os
import json
import argparse
from typing import Dict, List, Any
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.pydantic_v1 import BaseModel, Field
from langchain.agents import Tool
from langchain.graphs import LangGraph
from langchain.agents.agent_toolkits import create_react_agent
from langchain.tools.render import render_text_description
from langchain.tools import tool

# Define output schemas for structured analysis
class Vulnerability(BaseModel):
    id: str = Field(description="Unique identifier for the vulnerability")
    name: str = Field(description="Name of the vulnerability")
    severity: str = Field(description="Severity level (Critical, High, Medium, Low, Info)")
    description: str = Field(description="Description of the vulnerability")
    affected_component: str = Field(description="Component affected by the vulnerability")
    remediation: str = Field(description="Recommended remediation steps")

class SecurityReport(BaseModel):
    summary: str = Field(description="Executive summary of the security assessment")
    risk_level: str = Field(description="Overall risk level (Critical, High, Medium, Low)")
    vulnerabilities: List[Vulnerability] = Field(description="List of identified vulnerabilities")
    good_practices: List[str] = Field(description="Security good practices implemented")
    recommendations: List[str] = Field(description="Recommended security improvements")
    detailed_analysis: str = Field(description="Detailed security analysis")

class ReportGenerator:
    def __init__(self, api_key=None):
        # Use environment variable if API key not provided
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")
        
        if not self.api_key:
            raise ValueError("OpenAI API key not provided. Set OPENAI_API_KEY environment variable.")
        
        self.llm = ChatOpenAI(
            model="gpt-4",
            temperature=0,
            api_key=self.api_key
        )
        
        # Set up output parser for structured output
        self.output_parser = JsonOutputParser(pydantic_object=SecurityReport)
        
    def load_scan_results(self, scan_dir: str) -> Dict[str, Any]:
        """Load all scan results from the specified directory."""
        results = {}
        
        # Map of expected files to their keys in the results dictionary
        file_mappings = {
            "zap-report.json": "zap",
            "sqlmap-results.json": "sqlmap",
            "nikto-results.json": "nikto",
            "nuclei-results.json": "nuclei",
            "ssrfmap-results.txt": "ssrfmap",
            "dependency-check-report.json": "dependencies"
        }
        
        for filename, key in file_mappings.items():
            filepath = os.path.join(scan_dir, filename)
            if os.path.exists(filepath):
                try:
                    if filename.endswith(".json"):
                        with open(filepath, 'r') as f:
                            results[key] = json.load(f)
                    else:
                        with open(filepath, 'r') as f:
                            results[key] = f.read()
                except Exception as e:
                    print(f"Error loading {filename}: {e}")
                    results[key] = {"error": f"Failed to load: {str(e)}"}
            else:
                print(f"Warning: {filepath} not found")
                results[key] = {"status": "not_found"}
                
        return results

    def generate_report(self, scan_results: Dict[str, Any], target_url: str) -> SecurityReport:
        """Generate a security report using the AI analysis engine."""
        # Create a prompt template for the analysis
        prompt = ChatPromptTemplate.from_template("""
            You are an expert security analyst tasked with analyzing security scan results and providing actionable insights.
            
            Target URL: {target_url}
            
            Based on the following scan results, generate a comprehensive security report:
            
            ZAP Scan Results:
            {zap_results}
            
            SQLMap Results:
            {sqlmap_results}
            
            Nikto Scan Results:
            {nikto_results}
            
            Nuclei Scan Results:
            {nuclei_results}
            
            SSRFMap Results:
            {ssrfmap_results}
            
            Dependency Check Results:
            {dependency_results}
            
            Provide a structured analysis focusing on:
            1. Executive summary
            2. Overall risk assessment
            3. Identified vulnerabilities with severity ratings
            4. Security good practices already implemented
            5. Recommendations for improvement
            6. Detailed analysis of security issues
            
            Format your response as a JSON object with the following structure:
            {format_instructions}
        """)
        
        # Prepare the format instructions for the output parser
        format_instructions = self.output_parser.get_format_instructions()
        
        # Convert scan results to strings for the prompt
        zap_results = json.dumps(scan_results.get("zap", {}), indent=2)
        sqlmap_results = json.dumps(scan_results.get("sqlmap", {}), indent=2)
        nikto_results = json.dumps(scan_results.get("nikto", {}), indent=2)
        nuclei_results = json.dumps(scan_results.get("nuclei", {}), indent=2)
        ssrfmap_results = scan_results.get("ssrfmap", "No SSRF results found")
        dependency_results = json.dumps(scan_results.get("dependencies", {}), indent=2)
        
        # Prepare the prompt with scan results
        chain = prompt | self.llm | self.output_parser
        
        # Generate the report
        report = chain.invoke({
            "target_url": target_url,
            "zap_results": zap_results[:5000],  # Limit size to avoid context length issues
            "sqlmap_results": sqlmap_results[:5000],
            "nikto_results": nikto_results[:5000],
            "nuclei_results": nuclei_results[:5000],
            "ssrfmap_results": ssrfmap_results[:5000],
            "dependency_results": dependency_results[:5000],
            "format_instructions": format_instructions
        })
        
        return report

# LangGraph implementation for more sophisticated analysis
def build_security_analysis_graph(api_key=None):
    """Build a LangGraph for security analysis."""
    api_key = api_key or os.environ.get("OPENAI_API_KEY")
    
    if not api_key:
        raise ValueError("OpenAI API key not provided. Set OPENAI_API_KEY environment variable.")
    
    llm = ChatOpenAI(
        model="gpt-4",
        temperature=0,
        api_key=api_key
    )
    
    # Define tools for the graph
    @tool
    def analyze_zap_results(zap_results: str) -> str:
        """Analyze ZAP scan results and extract key vulnerabilities."""
        return llm.invoke(f"Analyze these ZAP scan results and extract the most critical vulnerabilities:\n{zap_results[:3000]}")
    
    @tool
    def analyze_sqlmap_results(sqlmap_results: str) -> str:
        """Analyze SQLMap results and determine SQL injection vulnerabilities."""
        return llm.invoke(f"Analyze these SQLMap results and determine if there are SQL injection vulnerabilities:\n{sqlmap_results[:3000]}")
    
    @tool
    def analyze_nikto_results(nikto_results: str) -> str:
        """Analyze Nikto results and extract key findings."""
        return llm.invoke(f"Analyze these Nikto scan results and extract the most important findings:\n{nikto_results[:3000]}")
    
    @tool
    def analyze_nuclei_results(nuclei_results: str) -> str:
        """Analyze Nuclei results and identify important vulnerabilities."""
        return llm.invoke(f"Analyze these Nuclei scan results and identify the most important vulnerabilities:\n{nuclei_results[:3000]}")
    
    @tool
    def generate_recommendations(analysis_results: str) -> str:
        """Generate security recommendations based on analysis results."""
        return llm.invoke(f"Based on the following security analysis, generate specific recommendations for improvement:\n{analysis_results}")
    
    @tool
    def assess_overall_risk(analysis_results: str) -> str:
        """Assess the overall security risk based on analysis results."""
        return llm.invoke(f"Based on the following security analysis, assess the overall security risk level (Critical, High, Medium, Low) and provide justification:\n{analysis_results}")
    
    # Create a list of tools
    tools = [
        analyze_zap_results,
        analyze_sqlmap_results,
        analyze_nikto_results,
        analyze_nuclei_results,
        generate_recommendations,
        assess_overall_risk
    ]
    
    # Create the React agent
    agent_executor = create_react_agent(
        llm=llm,
        tools=tools,
        prompt=ChatPromptTemplate.from_template("""
            You are an expert security analyst tasked with analyzing security scan results and providing actionable insights.
            
            Your goal is to:
            1. Analyze the security scan results thoroughly
            2. Identify critical vulnerabilities
            3. Assess the overall security risk
            4. Generate specific recommendations for improvement
            
            You have access to the following tools:
            
            {tools}
            
            Use these tools to analyze the scan results and generate a comprehensive security report.
            
            Human: {input}
            Agent: 
        """).partial(tools=render_text_description(tools)),
    )
    
    # Create the graph
    workflow = LangGraph(agent_executor)
    
    return workflow

def main():
    parser = argparse.ArgumentParser(description="AI Security Analysis Engine")
    parser.add_argument("--scan-dir", required=True, help="Directory containing security scan results")
    parser.add_argument("--target-url", required=True, help="Target URL that was scanned")
    parser.add_argument("--api-key", help="OpenAI API key")
    parser.add_argument("--output", default="security-report.json", help="Output file for the security report")
    
    args = parser.parse_args()
    
    # Initialize the report generator
    report_generator = ReportGenerator(api_key=args.api_key)
    
    # Load scan results
    scan_results = report_generator.load_scan_results(args.scan_dir)
    
    # Generate the report
    report = report_generator.generate_report(scan_results, args.target_url)
    
    # Save the report to a file
    with open(args.output, 'w') as f:
        json.dump(report.dict(), f, indent=2)
    
    print(f"Security report generated and saved to {args.output}")
    
    # Generate a more detailed analysis using LangGraph
    print("Generating detailed analysis using LangGraph...")
    graph = build_security_analysis_graph(api_key=args.api_key)
    
    # Run the graph with the scan results
    graph_input = f"""
    Target URL: {args.target_url}
    
    Analyze the following security scan results:
    
    ZAP Scan Results: {json.dumps(scan_results.get('zap', {}), indent=2)[:1000]}
    SQLMap Results: {json.dumps(scan_results.get('sqlmap', {}), indent=2)[:1000]}
    Nikto Results: {json.dumps(scan_results.get('nikto', {}), indent=2)[:1000]}
    Nuclei Results: {json.dumps(scan_results.get('nuclei', {}), indent=2)[:1000]}
    """
    
    graph_output = graph.invoke({"input": graph_input})
    
    # Save the graph output to a file
    with open("detailed-analysis.json", 'w') as f:
        json.dump(graph_output, f, indent=2)
    
    print("Detailed analysis generated and saved to detailed-analysis.json")

if __name__ == "__main__":
    main()