from typing import Dict, List, Any, Literal, TypedDict, Optional, Tuple
import json
import numpy as np
from json_analyzer_agent import JSONAnalyzerAgent

# LangChain and LangGraph imports
from langchain_core.messages import HumanMessage, AIMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from dotenv import load_dotenv
load_dotenv()  # Load variables from .env file into os.environ

class AnalysisState(TypedDict):
    """State for our LangGraph analysis flow"""
    json_data: Optional[Dict[str, Any]]
    statistical_analysis: Optional[Dict[str, Any]]
    anomalies: Optional[List[Dict[str, Any]]]
    context: Optional[List[str]]
    ai_insights: Optional[Dict[str, Any]]
    final_report: Optional[str]
    error: Optional[str]

class GeminiEnhancedAnalyzer:
    """
    A Gemini-enhanced JSON analyzer that combines statistical analysis with LLM insights
    """
    
    def __init__(self, gemini_api_key: str, model_name: str = "gemini-pro"):
        """
        Initialize the Gemini-enhanced analyzer
        
        Args:
            gemini_api_key: Google AI API key
            model_name: Gemini model to use (default: gemini-pro)
        """
        self.traditional_analyzer = JSONAnalyzerAgent()
        self.llm = ChatGoogleGenerativeAI(
            model=model_name, 
            google_api_key=gemini_api_key,
            temperature=0.2
        )
        self.workflow = self._create_workflow()
        
    def _create_workflow(self) -> StateGraph:
        """Create the LangGraph workflow for analysis"""
        
        # Define our workflow graph
        workflow = StateGraph(AnalysisState)
        
        # Add nodes to our graph
        workflow.add_node("validate_json", self._validate_json)
        workflow.add_node("perform_statistical_analysis", self._perform_statistical_analysis)
        workflow.add_node("extract_insights", self._extract_ai_insights)
        workflow.add_node("generate_final_report", self._generate_final_report)
        
        workflow.set_entry_point("validate_json")

        # Define the edges in our graph
        workflow.add_edge("validate_json", "perform_statistical_analysis")
        workflow.add_edge("perform_statistical_analysis", "extract_insights")
        workflow.add_edge("extract_insights", "generate_final_report")
        workflow.add_edge("generate_final_report", END)
        
        # Add conditional edges for error handling
        workflow.add_conditional_edges(
            "validate_json",
            self._handle_validation_result,
            {
                "success": "perform_statistical_analysis",
                "error": END
            }
        )
        
        # Compile the graph
        return workflow.compile()
        
    def _validate_json(self, state: AnalysisState) -> AnalysisState:
        """Validate the JSON data"""
        if not state.get("json_data"):
            return {"error": "No JSON data provided"}
            
        try:
            # Ensure the data is valid
            json_str = json.dumps(state["json_data"])
            json.loads(json_str)
            return state
        except Exception as e:
            return {"error": f"Invalid JSON data: {str(e)}"}
            
    def _handle_validation_result(self, state: AnalysisState) -> str:
        """Determine next step based on validation result"""
        return "error" if state.get("error") else "success"
        
    def _perform_statistical_analysis(self, state: AnalysisState) -> AnalysisState:
        """Perform statistical analysis using the traditional analyzer"""
        try:
            # Use our existing statistical analyzer
            self.traditional_analyzer.data = state["json_data"]
            analysis = self.traditional_analyzer.analyze_data()
            anomalies = self.traditional_analyzer.detect_anomalies()["anomalies"]
            
            # Update state with results
            state["statistical_analysis"] = analysis
            state["anomalies"] = anomalies
            
            # Create context for the LLM
            context = []
            
            # Add structure information
            if analysis.get("type") == "object":
                keys = analysis.get("keys", [])
                context.append(f"The JSON contains {len(keys)} top-level keys: {', '.join(keys)}")
            
            # Add anomaly information
            if anomalies:
                context.append(f"Found {len(anomalies)} statistical anomalies in the data")
                for anomaly in anomalies[:5]:  # Limit to first 5 anomalies
                    context.append(f"Anomaly at {anomaly['path']}: value {anomaly['value']} (z-score: {anomaly['z_score']:.2f})")
            else:
                context.append("No statistical anomalies detected")
                
            state["context"] = context
            return state
        except Exception as e:
            state["error"] = f"Error in statistical analysis: {str(e)}"
            return state
            
    def _extract_ai_insights(self, state: AnalysisState) -> AnalysisState:
        """Use Gemini to extract deeper insights from the data"""
        if state.get("error"):
            return state
            
        try:
            # Create a prompt for Gemini
            prompt = ChatPromptTemplate.from_template("""
            You are an AI data analyst specializing in JSON data analysis. Analyze the following JSON data and provide insights:

            JSON DATA:
            ```json
            {json_data}
            ```

            STATISTICAL ANALYSIS CONTEXT:
            {context}
            
            Please provide the following insights about this data in JSON format:
            1. "summary": A concise summary of what this data represents
            2. "potential_causes": An array of potential root causes for any anomalies detected
            3. "data_quality": A brief assessment of the data quality
            4. "patterns": An array of patterns or trends you identify
            5. "recommendations": An array of recommendations for further analysis or improvements
            
            Return ONLY valid JSON with these 5 keys and nothing else. No markdown formatting, no explanations, just the JSON object.
            """)
            
            # Format the prompt with our data
            formatted_prompt = prompt.format(
                json_data=json.dumps(state["json_data"], indent=2),
                context="\n".join(state["context"])
            )
            
            # Get insights from Gemini
            result = self.llm.invoke([HumanMessage(content=formatted_prompt)])
            
            # Parse the response as JSON
            response_text = result.content
            # Extract the JSON part from the response (handle cases where the model adds markdown formatting)
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()
                
            ai_insights = json.loads(response_text)
            state["ai_insights"] = ai_insights
            
            return state
        except Exception as e:
            # If we can't parse the LLM output as JSON, create a basic structure
            state["ai_insights"] = {
                "summary": "Unable to generate AI insights",
                "potential_causes": ["Error processing with AI model"],
                "data_quality": "Unknown",
                "patterns": [],
                "recommendations": ["Re-run analysis with valid API key"]
            }
            state["error"] = f"Warning: Error in AI insight extraction: {str(e)}"
            return state
            
    def _generate_final_report(self, state: AnalysisState) -> AnalysisState:
        """Generate the final comprehensive report"""
        if state.get("error") and not state.get("statistical_analysis"):
            state["final_report"] = f"Analysis failed: {state['error']}"
            return state
            
        # Get the traditional report
        self.traditional_analyzer.stats = state["statistical_analysis"]
        traditional_report = self.traditional_analyzer.generate_report()
        
        # Combine with AI insights if available
        if state.get("ai_insights"):
            ai_insights = state["ai_insights"]
            
            ai_report = []
            ai_report.append("\n=== Gemini Analysis Insights ===\n")
            
            # Data summary
            ai_report.append("Data Summary:")
            ai_report.append(ai_insights.get("summary", "No summary available"))
            
            # Anomaly explanations
            if state.get("anomalies") and ai_insights.get("potential_causes"):
                ai_report.append("\nPotential Causes for Anomalies:")
                for cause in ai_insights["potential_causes"]:
                    ai_report.append(f"- {cause}")
                    
            # Data quality
            ai_report.append(f"\nData Quality Assessment: {ai_insights.get('data_quality', 'Unknown')}")
            
            # Patterns
            if ai_insights.get("patterns"):
                ai_report.append("\nIdentified Patterns and Trends:")
                for pattern in ai_insights["patterns"]:
                    ai_report.append(f"- {pattern}")
                    
            # Recommendations
            if ai_insights.get("recommendations"):
                ai_report.append("\nRecommendations:")
                for rec in ai_insights["recommendations"]:
                    ai_report.append(f"- {rec}")
                    
            # Combine reports
            final_report = traditional_report + "\n" + "\n".join(ai_report)
        else:
            final_report = traditional_report
            
        # Add any warnings/errors
        if state.get("error"):
            final_report += f"\n\nWarning: {state['error']}"
            
        state["final_report"] = final_report
        return state
        
    def analyze(self, json_data: Dict[str, Any]) -> str:
        """
        Analyze JSON data and return the comprehensive report
        
        Args:
            json_data: The JSON data to analyze
            
        Returns:
            A string containing the analysis report
        """
        # Set up initial state
        initial_state = AnalysisState(
            json_data=json_data,
            statistical_analysis=None,
            anomalies=None,
            context=None,
            ai_insights=None,
            final_report=None,
            error=None
        )
        
        # Execute the workflow
        final_state = self.workflow.invoke(initial_state)
        
        # Return the final report
        return final_state.get("final_report", "Analysis failed")

    def analyze_json_string(self, json_string: str) -> str:
        """
        Analyze a JSON string
        
        Args:
            json_string: JSON data as a string
            
        Returns:
            Analysis report
        """
        try:
            data = json.loads(json_string)
            return self.analyze(data)
        except json.JSONDecodeError as e:
            return f"Invalid JSON string: {str(e)}"
            
    def analyze_json_file(self, filepath: str) -> str:
        """
        Analyze JSON from a file
        
        Args:
            filepath: Path to JSON file
            
        Returns:
            Analysis report
        """
        try:
            with open(filepath, 'r') as f:
                data = json.load(f)
            return self.analyze(data)
        except (json.JSONDecodeError, FileNotFoundError) as e:
            return f"Error loading JSON file: {str(e)}"


# Example usage
if __name__ == "__main__":
    import os
    
    # Get API key from environment variable
    api_key = os.environ.get("GOOGLE_API_KEY")
    
    if not api_key:
        print("Warning: No Google API key found in environment variables.")
        print("Set your API key with: export GOOGLE_API_KEY='your-key-here'")
        print("Running with limited functionality (statistical analysis only)...")
    
    # Sample data with anomalies
    sample_data = {
        "metrics": {
            "temperatures": [22.1, 22.3, 22.0, 21.9, 22.2, 35.7, 22.1],
            "humidity": [45.2, 44.9, 45.1, 44.8, 95.6, 45.3],
            "pressure": [1013, 1014, 1012, 1013, 1011, 1014]
        },
        "user_info": {
            "name": "John Doe",
            "age": 30,
            "email": "john@example.com",
            "active": True,
            "login_count": 27,
            "previous_logins": ["2025-04-25", "2025-04-20", "2025-04-15"]
        },
        "sensor_readings": [
            {"sensor_id": 1, "value": 345, "timestamp": "2025-04-28T14:30:00"},
            {"sensor_id": 2, "value": 347, "timestamp": "2025-04-28T14:35:00"},
            {"sensor_id": 3, "value": 352, "timestamp": "2025-04-28T14:40:00"},
            {"sensor_id": 4, "value": 12,  "timestamp": "2025-04-28T14:45:00"},  # Anomaly
            {"sensor_id": 5, "value": 348, "timestamp": "2025-04-28T14:50:00"}
        ]
    }
    
    # Create analyzer
    analyzer = GeminiEnhancedAnalyzer(gemini_api_key=api_key or "dummy-key")
    
    # Run analysis
    if api_key:
        report = analyzer.analyze(sample_data)
        print(report)
    else:
        # Run just the traditional analysis without AI enhancements
        traditional_analyzer = JSONAnalyzerAgent()
        traditional_analyzer.data = sample_data
        traditional_analyzer.analyze_data()
        print(traditional_analyzer.generate_report())