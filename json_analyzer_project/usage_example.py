import json
from json_analyzer_agent import JSONAnalyzerAgent

def generate_sample_data():
    """Generate sample data with anomalies for demonstration"""
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
        ],
        "system_status": {
            "cpu_usage": [12, 15, 14, 16, 78, 14],  # Anomaly at index 4
            "memory_usage": [45, 46, 47, 45, 46, 45],
            "disk_space": [
                {"partition": "C:", "percent_used": 68},
                {"partition": "D:", "percent_used": 23},
                {"partition": "E:", "percent_used": 92}  # Not an anomaly, just high
            ]
        }
    }
    return sample_data

def interactive_demo():
    """Run an interactive demo of the JSON analyzer agent"""
    analyzer = JSONAnalyzerAgent(z_threshold=2.0)
    
    print("=" * 60)
    print("JSON Analyzer Agent - Interactive Demo")
    print("=" * 60)
    
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
            print(json.dumps(sample_data, indent=2))
            
            analyzer.data = sample_data
            analyzer.analyze_data()
            print("\n" + analyzer.generate_report())
            
        elif choice == '2':
            # Manual JSON input
            print("\nEnter your JSON data (press Enter + Ctrl+D or Ctrl+Z on Windows when done):")
            lines = []
            while True:
                try:
                    line = input()
                    lines.append(line)
                except EOFError:
                    break
            
            json_input = "\n".join(lines)
            
            if analyzer.load_json(json_input):
                analyzer.analyze_data()
                print("\n" + analyzer.generate_report())
            else:
                print("Failed to load JSON. Please check the format and try again.")
                
        elif choice == '3':
            # Load from file
            filepath = input("\nEnter the path to your JSON file: ").strip()
            
            if analyzer.load_json_from_file(filepath):
                analyzer.analyze_data()
                print("\n" + analyzer.generate_report())
            else:
                print(f"Failed to load JSON from '{filepath}'. Please check the file and try again.")
                
        elif choice == '4':
            # Exit
            print("\nExiting JSON Analyzer. Goodbye!")
            break
            
        else:
            print("\nInvalid choice. Please select a number between 1 and 4.")

def save_sample_data():
    """Save sample data to a file for later use"""
    sample_data = generate_sample_data()
    
    with open("sample_data.json", "w") as f:
        json.dump(sample_data, f, indent=2)
    
    print(f"Sample data saved to 'sample_data.json'")

if __name__ == "__main__":
    interactive_demo()
    
    # Uncomment to save sample data to a file
    # save_sample_data()