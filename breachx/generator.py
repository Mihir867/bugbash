import json
import argparse
import os
from datetime import datetime
import markdown
import matplotlib.pyplot as plt
import numpy as np
from fpdf import FPDF
from jinja2 import Environment, FileSystemLoader

class ReportGenerator:
    def __init__(self, report_json_path):
        """Initialize the report generator with the path to the JSON report."""
        with open(report_json_path, 'r') as f:
            self.report_data = json.load(f)
        
        self.now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        # Create output directory
        self.output_dir = "generated-reports"
        os.makedirs(self.output_dir, exist_ok=True)
    
    def _create_vulnerability_chart(self):
        """Create a chart showing vulnerability distribution by severity."""
        # Count vulnerabilities by severity
        severity_counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0, "Info": 0}
        
        for vuln in self.report_data.get("vulnerabilities", []):
            severity = vuln.get("severity", "Info")
            if severity in severity_counts:
                severity_counts[severity] += 1
        
        # Create the chart
        labels = list(severity_counts.keys())
        values = list(severity_counts.values())
        colors = ['darkred', 'red', 'orange', 'yellow', 'green']
        
        plt.figure(figsize=(10, 6))
        bars = plt.bar(labels, values, color=colors)
        
        plt.title('Vulnerabilities by Severity')
        plt.xlabel('Severity')
        plt.ylabel('Count')
        
        # Add count labels on top of each bar
        for bar in bars:
            height = bar.get_height()
            plt.text(bar.get_x() + bar.get_width()/2., height + 0.1,
                    '%d' % int(height), ha='center', va='bottom')
        
        chart_path = os.path.join(self.output_dir, 'vulnerability_chart.png')
        plt.savefig(chart_path)
        plt.close()
        
        return chart_path
    
    def _create_risk_radar_chart(self):
        """Create a radar chart showing risk areas."""
        # Define risk categories and extract scores
        categories = ['Injection', 'Authentication', 'Data Exposure', 'XSS', 'Access Control']
        
        # This would normally be calculated from the detailed report
        # Here we're generating sample values based on vulnerabilities
        scores = []
        vuln_count = len(self.report_data.get("vulnerabilities", []))
        
        # Sample logic to generate risk scores
        scores = [
            min(10, sum(1 for v in self.report_data.get("vulnerabilities", []) if "SQL" in v.get("name", ""))),
            min(10, sum(1 for v in self.report_data.get("vulnerabilities", []) if "auth" in v.get("name", "").lower())),
            min(10, sum(1 for v in self.report_data.get("vulnerabilities", []) if "data" in v.get("name", "").lower())),
            min(10, sum(1 for v in self.report_data.get("vulnerabilities", []) if "XSS" in v.get("name", ""))),
            min(10, sum(1 for v in self.report_data.get("vulnerabilities", []) if "access" in v.get("name", "").lower()))
        ]
        
        # Create the radar chart
        angles = np.linspace(0, 2*np.pi, len(categories), endpoint=False).tolist()
        angles += angles[:1]  # Close the loop
        
        scores += scores[:1]  # Close the loop
        
        fig, ax = plt.subplots(figsize=(8, 8), subplot_kw=dict(polar=True))
        ax.plot(angles, scores, 'o-', linewidth=2)
        ax.fill(angles, scores, alpha=0.25)
        ax.set_thetagrids(np.degrees(angles[:-1]), categories)
        
        ax.set_ylim(0, 10)
        ax.grid(True)
        
        plt.title('Security Risk Areas', size=15)
        
        chart_path = os.path.join(self.output_dir, 'risk_radar_chart.png')
        plt.savefig(chart_path)
        plt.close()
        
        return chart_path
    
    def generate_html_report(self):
        """Generate an HTML report from the JSON data."""
        # Create charts
        vuln_chart = self._create_vulnerability_chart()
        risk_chart = self._create_risk_radar_chart()
        
        # Set up Jinja2 environment
        env = Environment(loader=FileSystemLoader('.'))
        
        # First, create the template file
        html_template = """
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Security Assessment Report</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .header {
                    background-color: #2c3e50;
                    color: white;
                    padding: 20px;
                    border-radius: 5px 5px 0 0;
                }
                .content {
                    padding: 20px;
                    background-color: #f9f9f9;
                    border: 1px solid #ddd;
                }
                .footer {
                    text-align: center;
                    margin-top: 20px;
                    font-size: 0.9em;
                    color: #777;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                }
                th, td {
                    padding: 12px;
                    text-align: left;
                    border-bottom: 1px solid #ddd;
                }
                th {
                    background-color: #f2f2f2;
                }
                .risk-critical {
                    background-color: #FFCCCC;
                }
                .risk-high {
                    background-color: #FFDDCC;
                }
                .risk-medium {
                    background-color: #FFFFCC;
                }
                .risk-low {
                    background-color: #CCFFCC;
                }
                .summary-box {
                    border: 1px solid #ddd;
                    padding: 15px;
                    background-color: #f5f5f5;
                    margin-bottom: 20px;
                }
                .chart-container {
                    text-align: center;
                    margin: 20px 0;
                }
                .chart-container img {
                    max-width: 100%;
                    height: auto;
                }
                .badge {
                    display: inline-block;
                    padding: 5px 10px;
                    border-radius: 3px;
                    color: white;
                    font-weight: bold;
                }
                .badge-critical {
                    background-color: #d9534f;
                }
                .badge-high {
                    background-color: #f0ad4e;
                }
                .badge-medium {
                    background-color: #ffd700;
                    color: #333;
                }
                .badge-low {
                    background-color: #5cb85c;
                }
                .badge-info {
                    background-color: #5bc0de;
                }
                .recommendations {
                    background-color: #e8f4f8;
                    padding: 15px;
                    border-left: 5px solid #5bc0de;
                }
                .good-practices {
                    background-color: #dff0d8;
                    padding: 15px;
                    border-left: 5px solid #5cb85c;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Security Assessment Report</h1>
                <p>Generated on: {{ generation_date }}</p>
            </div>
            
            <div class="content">
                <h2>Executive Summary</h2>
                <div class="summary-box">
                    <p>{{ report.summary }}</p>
                    <p><strong>Overall Risk Level:</strong> 
                        <span class="badge badge-{{ report.risk_level.lower() }}">{{ report.risk_level }}</span>
                    </p>
                </div>
                
                <div class="chart-container">
                    <h3>Vulnerability Distribution</h3>
                    <img src="{{ vuln_chart_path }}" alt="Vulnerability Distribution">
                </div>
                
                <div class="chart-container">
                    <h3>Risk Assessment by Category</h3>
                    <img src="{{ risk_chart_path }}" alt="Risk Radar Chart">
                </div>
                
                <h2>Vulnerabilities</h2>
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Severity</th>
                            <th>Affected Component</th>
                        </tr>
                    </thead>
                    <tbody>
                        {% for vuln in report.vulnerabilities %}
                        <tr class="risk-{{ vuln.severity.lower() }}">
                            <td>{{ vuln.id }}</td>
                            <td>{{ vuln.name }}</td>
                            <td>
                                <span class="badge badge-{{ vuln.severity.lower() }}">{{ vuln.severity }}</span>
                            </td>
                            <td>{{ vuln.affected_component }}</td>
                        </tr>
                        {% endfor %}
                    </tbody>
                </table>
                
                <h2>Good Security Practices</h2>
                <div class="good-practices">
                    <ul>
                        {% for practice in report.good_practices %}
                        <li>{{ practice }}</li>
                        {% endfor %}
                    </ul>
                </div>
                
                <h2>Recommendations</h2>
                <div class="recommendations">
                    <ul>
                        {% for recommendation in report.recommendations %}
                        <li>{{ recommendation }}</li>
                        {% endfor %}
                    </ul>
                </div>
                
                <h2>Detailed Analysis</h2>
                <div>
                    {{ report.detailed_analysis | safe }}
                </div>
                
                <h2>Vulnerability Details</h2>
                {% for vuln in report.vulnerabilities %}
                <div class="vulnerability-detail">
                    <h3>{{ vuln.name }} <span class="badge badge-{{ vuln.severity.lower() }}">{{ vuln.severity }}</span></h3>
                    <p><strong>ID:</strong> {{ vuln.id }}</p>
                    <p><strong>Affected Component:</strong> {{ vuln.affected_component }}</p>
                    <p><strong>Description:</strong> {{ vuln.description }}</p>
                    <div class="remediation">
                        <h4>Remediation</h4>
                        <p>{{ vuln.remediation }}</p>
                    </div>
                </div>
                {% endfor %}
                
            </div>
            
            <div class="footer">
                <p>Generated by Security Assessment Platform</p>
                <p>© {{ current_year }} - All rights reserved</p>
            </div>
        </body>
        </html>
        """
        
        # Write the template to a file
        with open(os.path.join(self.output_dir, 'report_template.html'), 'w') as f:
            f.write(html_template)
        
        # Load the template
        template = env.from_string(html_template)
        
        # Render the template with the report data
        html_content = template.render(
            report=self.report_data,
            generation_date=self.now,
            current_year=datetime.now().year,
            vuln_chart_path="vulnerability_chart.png",
            risk_chart_path="risk_radar_chart.png"
        )
        
        # Write the HTML report to a file
        html_report_path = os.path.join(self.output_dir, 'security_report.html')
        with open(html_report_path, 'w') as f:
            f.write(html_content)
        
        return html_report_path
    
    def generate_pdf_report(self):
        """Generate a PDF report from the HTML report."""
        from weasyprint import HTML
        
        # First generate the HTML report
        html_path = self.generate_html_report()
        
        # Convert HTML to PDF
        pdf_path = os.path.join(self.output_dir, 'security_report.pdf')
        HTML(filename=html_path).write_pdf(pdf_path)
        
        return pdf_path
    
    def generate_markdown_report(self):
        """Generate a Markdown report from the JSON data."""
        # Create a markdown template
        md_content = f"""
# Security Assessment Report

**Generated on:** {self.now}

## Executive Summary

{self.report_data.get('summary', 'No summary available.')}

**Overall Risk Level:** {self.report_data.get('risk_level', 'Unknown')}

## Vulnerabilities

| ID | Name | Severity | Affected Component |
|----|------|----------|-------------------|
"""
        
        # Add vulnerability rows
        for vuln in self.report_data.get('vulnerabilities', []):
            md_content += f"| {vuln.get('id', 'N/A')} | {vuln.get('name', 'N/A')} | {vuln.get('severity', 'N/A')} | {vuln.get('affected_component', 'N/A')} |\n"
        
        # Add good practices
        md_content += "\n## Good Security Practices\n\n"
        for practice in self.report_data.get('good_practices', []):
            md_content += f"- {practice}\n"
        
        # Add recommendations
        md_content += "\n## Recommendations\n\n"
        for recommendation in self.report_data.get('recommendations', []):
            md_content += f"- {recommendation}\n"
        
        # Add detailed analysis
        md_content += f"\n## Detailed Analysis\n\n{self.report_data.get('detailed_analysis', 'No detailed analysis available.')}\n"
        
        # Add vulnerability details
        md_content += "\n## Vulnerability Details\n\n"
        for vuln in self.report_data.get('vulnerabilities', []):
            md_content += f"### {vuln.get('name', 'Unknown Vulnerability')}\n\n"
            md_content += f"**ID:** {vuln.get('id', 'N/A')}\n\n"
            md_content += f"**Severity:** {vuln.get('severity', 'N/A')}\n\n"
            md_content += f"**Affected Component:** {vuln.get('affected_component', 'N/A')}\n\n"
            md_content += f"**Description:** {vuln.get('description', 'No description available.')}\n\n"
            md_content += f"**Remediation:** {vuln.get('remediation', 'No remediation steps available.')}\n\n"
        
        # Write the markdown report to a file
        md_report_path = os.path.join(self.output_dir, 'security_report.md')
        with open(md_report_path, 'w') as f:
            f.write(md_content)
        
        return md_report_path

def main():
    parser = argparse.ArgumentParser(description="Security Report Generator")
    parser.add_argument("--report-json", required=True, help="Path to the JSON security report")
    parser.add_argument("--format", choices=["html", "pdf", "markdown", "all"], default="all", help="Report format to generate")
    
    args = parser.parse_args()
    
    # Initialize the report generator
    report_generator = ReportGenerator(args.report_json)
    
    # Generate the requested report format(s)
    if args.format == "html" or args.format == "all":
        html_path = report_generator.generate_html_report()
        print(f"HTML report generated: {html_path}")
    
    if args.format == "pdf" or args.format == "all":
        try:
            pdf_path = report_generator.generate_pdf_report()
            print(f"PDF report generated: {pdf_path}")
        except Exception as e:
            print(f"Error generating PDF report: {e}")
            print("PDF generation requires WeasyPrint. Install with: pip install weasyprint")
    
    if args.format == "markdown" or args.format == "all":
        md_path = report_generator.generate_markdown_report()
        print(f"Markdown report generated: {md_path}")

if __name__ == "__main__":
    main()