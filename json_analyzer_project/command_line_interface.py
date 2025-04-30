#!/usr/bin/env python3
import json
import argparse
import sys
from json_analyzer_agent import JSONAnalyzerAgent


def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description="JSON Analyzer Agent - Validate JSON, analyze data boundaries, and detect anomalies"
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
        help="Output the analysis in JSON format instead of human-readable report"
    )
    
    return parser.parse_args()


def generate_sample_data():
    """Generate sample data with anomalies for demonstration"""
    from usage_example import generate_sample_data
    return generate_sample_data()


def run_interactive_mode():
    """Run the analyzer in interactive mode"""
    from usage_example import interactive_demo
    interactive_demo()


def main():
    """Main entry point for the command line interface"""
    args = parse_args()
    
    # Handle interactive mode separately
    if args.interactive:
        run_interactive_mode()
        return
    
    # Create the analyzer
    analyzer = JSONAnalyzerAgent(z_threshold=args.z_threshold)
    
    # Load the data
    if args.file:
        if not analyzer.load_json_from_file(args.file):
            print(f"Error: Could not load JSON from file '{args.file}'", file=sys.stderr)
            sys.exit(1)
    elif args.json:
        if not analyzer.load_json(args.json):
            print("Error: Invalid JSON provided", file=sys.stderr)
            sys.exit(1)
    elif args.sample:
        sample_data = generate_sample_data()
        analyzer.data = sample_data
    
    # Analyze the data
    stats = analyzer.analyze_data()
    
    # Generate output
    if args.json_output:
        # Output full stats as JSON
        output = json.dumps(stats, indent=2)
    else:
        # Generate human-readable report
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