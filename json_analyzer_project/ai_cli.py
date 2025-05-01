#!/usr/bin/env python3
import json
import argparse
import sys
import os
from json_analyzer_agent import JSONAnalyzerAgent
from ai_enhanced_analyzer import GeminiEnhancedAnalyzer

from dotenv import load_dotenv
load_dotenv()  # Load variables from .env file into os.environ

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description="Gemini-Enhanced JSON Analyzer - Validate JSON, analyze data, and provide AI insights"
    )
    
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument(
        "-f", "--file",
        help="Path to a JSON file to analyze"
    )
    input_group.add_argument(
        "-j", "--json",
        help="JSON string to analyze"
    )
    input_group.add_argument(
        "--sample",
        action="store_true",
        help="Use built-in sample data with anomalies"
    )
    input_group.add_argument(
        "--interactive",
        action="store_true",
        help="Run in interactive mode"
    )
    
    parser.add_argument(
        "--ai",
        action="store_true",
        help="Use Gemini-enhanced analysis (requires Google API key)"
    )
    
    parser.add_argument(
        "--model",
        default="gemini-pro",
        help="Google Gemini model to use (default: gemini-pro)"
    )
    
    parser.add_argument(
        "-z", "--z-threshold",
        type=float,
        default=2.0,
        help="Z-score threshold for anomaly detection (default: 2.0)"
    )
    
    parser.add_argument(
        "-o", "--output",
        help="Output file for the analysis report (default: stdout)"
    )
    
    parser.add_argument(
        "--json-output",
        action="store_true",
        help="Output the statistical analysis in JSON format (AI insights still in text)"
    )
    
    return parser.parse_args()


def generate_sample_data():
    """Generate sample data with anomalies for demonstration"""
    from usage_example import generate_sample_data
    return generate_sample_data()


def run_interactive_mode(api_key=None):
    """Run the analyzer in interactive mode"""
    from usage_example import generate_sample_data
    
    print("=" * 60)
    print("Gemini-Enhanced JSON Analyzer - Interactive Demo")
    print("=" * 60)
    
    # Determine mode
    use_ai = False
    if api_key:
        mode = input("\nDo you want to use Gemini AI analysis? (y/n): ").strip().lower()
        use_ai = mode.startswith('y')
        
        if use_ai:
            print("Using Gemini AI for enhanced analysis")
            analyzer = GeminiEnhancedAnalyzer(gemini_api_key=api_key)
        else:
            print("Using statistical analysis only")
            analyzer = JSONAnalyzerAgent()
    else:
        print("\nNo Google API key found. Running in statistical analysis mode only.")
        print("To use AI features, set your API key with: export GOOGLE_API_KEY='your-key-here'")
        analyzer = JSONAnalyzerAgent()
    
    while True:
        print("\nChoose an option:")
        print("1. Use sample data with anomalies")
        print("2. Enter your own JSON data")
        print("3. Load JSON from file")
        print("4. Exit")
        
        choice = input("\nEnter your choice (1-4): ").strip()
        
        if choice == '1':
            # Use sample data
            sample_data = generate_sample_data()
            print("\nUsing sample data with intentional anomalies:")
            print(json.dumps(sample_data, indent=2)[:500] + "... (truncated)")
            
            if use_ai:
                report = analyzer.analyze(sample_data)
            else:
                analyzer.data = sample_data
                analyzer.analyze_data()
                report = analyzer.generate_report()
                
            print("\n" + report)
            
        elif choice == '2':
            # Manual JSON input
            print("\nEnter your JSON data (press Enter + Ctrl+D or Ctrl+Z on Windows when done):")
            lines = []
            try:
                while True:
                    line = input()
                    lines.append(line)
            except EOFError:
                pass
            
            json_input = "\n".join(lines)
            
            try:
                data = json.loads(json_input)
                
                if use_ai:
                    report = analyzer.analyze(data)
                else:
                    analyzer.data = data
                    analyzer.analyze_data()
                    report = analyzer.generate_report()
                    
                print("\n" + report)
            except json.JSONDecodeError as e:
                print(f"Failed to load JSON: {e}")
                
        elif choice == '3':
            # Load from file
            filepath = input("\nEnter the path to your JSON file: ").strip()
            
            try:
                with open(filepath, 'r') as f:
                    data = json.load(f)
                
                if use_ai:
                    report = analyzer.analyze(data)
                else:
                    analyzer.data = data
                    analyzer.analyze_data()
                    report = analyzer.generate_report()
                    
                print("\n" + report)
            except (json.JSONDecodeError, FileNotFoundError) as e:
                print(f"Failed to load JSON from '{filepath}': {e}")
                
        elif choice == '4':
            # Exit
            print("\nExiting JSON Analyzer. Goodbye!")
            break
            
        else:
            print("\nInvalid choice. Please select a number between 1 and 4.")


def main():
    """Main entry point for the command line interface"""
    args = parse_args()
    
    # Check if using AI and have API key
    use_ai = args.ai
    api_key = os.environ.get("GOOGLE_API_KEY")
    
    if use_ai and not api_key:
        print("Error: Gemini analysis requested but no Google API key found in environment variables.", file=sys.stderr)
        print("Set your API key with: export GOOGLE_API_KEY='your-key-here'", file=sys.stderr)
        sys.exit(1)
    
    # Handle interactive mode separately
    if args.interactive:
        run_interactive_mode(api_key)
        return
    
    # Load the data
    json_data = None
    
    if args.file:
        try:
            with open(args.file, 'r') as f:
                json_data = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError) as e:
            print(f"Error: Could not load JSON from file '{args.file}': {e}", file=sys.stderr)
            sys.exit(1)
    elif args.json:
        try:
            json_data = json.loads(args.json)
        except json.JSONDecodeError as e:
            print(f"Error: Invalid JSON provided: {e}", file=sys.stderr)
            sys.exit(1)
    elif args.sample:
        json_data = generate_sample_data()
    
    # Perform analysis
    if use_ai:
        # AI-enhanced analysis
        analyzer = GeminiEnhancedAnalyzer(gemini_api_key=api_key, model_name=args.model)
        output = analyzer.analyze(json_data)
    else:
        # Traditional statistical analysis
        analyzer = JSONAnalyzerAgent(z_threshold=args.z_threshold)
        analyzer.data = json_data
        
        if args.json_output:
            # Output full stats as JSON
            stats = analyzer.analyze_data()
            output = json.dumps(stats, indent=2)
        else:
            # Generate human-readable report
            analyzer.analyze_data()
            output = analyzer.generate_report()
    
    # Write output
    if args.output:
        with open(args.output, "w") as f:
            f.write(output)
        print(f"Analysis report written to '{args.output}'")
    else:
        print(output)


if __name__ == "__main__":
    main()