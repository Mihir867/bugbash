import json
import numpy as np
import statistics
from datetime import datetime
from typing import Dict, List, Union, Tuple, Any, Optional

class JSONAnalyzerAgent:
    """
    An AI agent for analyzing JSON data, determining value boundaries,
    and detecting anomalies.
    """
    
    def __init__(self, z_threshold: float = 2.0):
        """
        Initialize the JSON analyzer agent.
        
        Args:
            z_threshold: Z-score threshold for anomaly detection (default: 2.0)
        """
        self.z_threshold = z_threshold
        self.data = None
        self.stats = {}
        
    def load_json(self, json_string: str) -> bool:
        """
        Load and validate JSON data.
        
        Args:
            json_string: JSON data as string
            
        Returns:
            bool: True if valid JSON, False otherwise
        """
        try:
            self.data = json.loads(json_string)
            return True
        except json.JSONDecodeError as e:
            print(f"Invalid JSON: {e}")
            return False
            
    def load_json_from_file(self, filepath: str) -> bool:
        """
        Load JSON from a file.
        
        Args:
            filepath: Path to JSON file
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            with open(filepath, 'r') as f:
                self.data = json.load(f)
            return True
        except (json.JSONDecodeError, FileNotFoundError) as e:
            print(f"Error loading JSON file: {e}")
            return False
    
    def analyze_data(self) -> Dict:
        """
        Analyze the JSON data to find boundaries and statistics.
        
        Returns:
            Dict containing statistics for each field
        """
        if not self.data:
            return {"error": "No data loaded"}
            
        self.stats = self._analyze_json_object(self.data)
        return self.stats
    
    def _analyze_json_object(self, obj: Any, path: str = "") -> Dict:
        """
        Recursively analyze a JSON object.
        
        Args:
            obj: JSON object or value
            path: Current path in the JSON structure
            
        Returns:
            Dict containing statistics
        """
        stats = {}
        
        if isinstance(obj, dict):
            # Analyze each key in the dictionary
            stats["type"] = "object"
            stats["properties"] = {}
            stats["keys"] = list(obj.keys())
            stats["key_count"] = len(obj.keys())
            
            for key, value in obj.items():
                current_path = f"{path}.{key}" if path else key
                stats["properties"][key] = self._analyze_json_object(value, current_path)
                
        elif isinstance(obj, list):
            # Analyze the list
            stats["type"] = "array"
            stats["length"] = len(obj)
            
            # Only perform detailed analysis if list is not empty
            if obj:
                # Analyze numeric arrays more thoroughly
                if all(isinstance(x, (int, float)) for x in obj):
                    numeric_array = np.array(obj, dtype=float)
                    stats["min"] = float(np.min(numeric_array))
                    stats["max"] = float(np.max(numeric_array))
                    stats["mean"] = float(np.mean(numeric_array))
                    stats["median"] = float(np.median(numeric_array))
                    if len(obj) > 1:
                        stats["std_dev"] = float(np.std(numeric_array))
                    
                    # Find potential anomalies using Z-score
                    stats["anomalies"] = self._detect_anomalies(numeric_array, path)
                
                # Sample element analysis (first 5 elements)
                stats["sample_elements"] = []
                for i, item in enumerate(obj[:5]):
                    current_path = f"{path}[{i}]"
                    stats["sample_elements"].append(self._analyze_json_object(item, current_path))
        
        elif isinstance(obj, (int, float)):
            # Analyze numeric value
            stats["type"] = "number"
            stats["value"] = obj
            
        elif isinstance(obj, str):
            # Analyze string value
            stats["type"] = "string"
            stats["length"] = len(obj)
            
            # Try to detect if it's a date
            if self._is_date(obj):
                stats["possible_date"] = True
                
        elif isinstance(obj, bool):
            stats["type"] = "boolean"
            stats["value"] = obj
            
        elif obj is None:
            stats["type"] = "null"
            
        else:
            stats["type"] = str(type(obj).__name__)
            
        return stats
    
    def _is_date(self, string_val: str) -> bool:
        """
        Check if a string might be a date.
        
        Args:
            string_val: String to check
            
        Returns:
            bool: True if string appears to be a date
        """
        date_formats = [
            "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", 
            "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"
        ]
        
        for fmt in date_formats:
            try:
                datetime.strptime(string_val, fmt)
                return True
            except ValueError:
                pass
        return False
    
    def _detect_anomalies(self, values: np.ndarray, path: str) -> List[Dict]:
        """
        Detect anomalies in an array of values using Z-score.
        
        Args:
            values: Array of numeric values
            path: Current path in the JSON structure
            
        Returns:
            List of anomalies
        """
        anomalies = []
        
        if len(values) < 3:  # Need at least 3 values for meaningful anomaly detection
            return anomalies
            
        mean = np.mean(values)
        std = np.std(values)
        
        if std == 0:  # All values are the same
            return anomalies
            
        for i, value in enumerate(values):
            z_score = abs((value - mean) / std)
            if z_score > self.z_threshold:
                anomalies.append({
                    "index": i,
                    "value": float(value),
                    "z_score": float(z_score),
                    "path": f"{path}[{i}]"
                })
                
        return anomalies
    
    def detect_anomalies(self) -> Dict:
        """
        Find anomalies across the entire JSON structure.
        
        Returns:
            Dict containing all detected anomalies
        """
        if not self.stats:
            self.analyze_data()
            
        all_anomalies = self._collect_anomalies(self.stats)
        return {"anomalies": all_anomalies}
    
    def _collect_anomalies(self, stats_obj: Dict) -> List[Dict]:
        """
        Recursively collect anomalies from the statistics object.
        
        Args:
            stats_obj: Statistics object
            
        Returns:
            List of all anomalies
        """
        anomalies = []
        
        if "anomalies" in stats_obj:
            anomalies.extend(stats_obj["anomalies"])
            
        if "properties" in stats_obj:
            for _, prop_stats in stats_obj["properties"].items():
                anomalies.extend(self._collect_anomalies(prop_stats))
                
        if "sample_elements" in stats_obj:
            for elem_stats in stats_obj["sample_elements"]:
                anomalies.extend(self._collect_anomalies(elem_stats))
                
        return anomalies
    
    def generate_report(self) -> str:
        """
        Generate a human-readable report of the analysis.
        
        Returns:
            String containing the analysis report
        """
        if not self.stats:
            return "No data has been analyzed yet."
            
        report = []
        report.append("=== JSON Analysis Report ===\n")
        
        # Add structure overview
        if self.stats.get("type") == "object":
            report.append(f"Root object with {self.stats.get('key_count')} keys: {', '.join(self.stats.get('keys', []))}\n")
        
        # Add boundaries for numeric values
        boundaries = self._collect_boundaries(self.stats)
        if boundaries:
            report.append("=== Value Boundaries ===")
            for path, bounds in boundaries.items():
                report.append(f"\n{path}:")
                for key, value in bounds.items():
                    if key not in ["type", "anomalies", "sample_elements", "properties"]:
                        report.append(f"  {key}: {value}")
        
        # Add anomalies
        anomalies = self.detect_anomalies()["anomalies"]
        if anomalies:
            report.append("\n=== Detected Anomalies ===")
            for anomaly in anomalies:
                report.append(f"\nPath: {anomaly['path']}")
                report.append(f"Value: {anomaly['value']}")
                report.append(f"Z-score: {anomaly['z_score']:.2f}")
        else:
            report.append("\nNo anomalies detected.")
            
        return "\n".join(report)
    
    def _collect_boundaries(self, stats_obj: Dict, path: str = "root") -> Dict:
        """
        Recursively collect value boundaries from the statistics object.
        
        Args:
            stats_obj: Statistics object
            path: Current path
            
        Returns:
            Dict containing boundaries for each path
        """
        boundaries = {}
        
        if stats_obj.get("type") == "array" and "min" in stats_obj:
            # Add numeric array stats
            boundaries[path] = {
                "min": stats_obj["min"],
                "max": stats_obj["max"],
                "mean": stats_obj["mean"],
                "median": stats_obj["median"]
            }
            if "std_dev" in stats_obj:
                boundaries[path]["std_dev"] = stats_obj["std_dev"]
                
        elif stats_obj.get("type") == "object" and "properties" in stats_obj:
            # Recursively process object properties
            for key, prop_stats in stats_obj["properties"].items():
                prop_path = f"{path}.{key}"
                sub_boundaries = self._collect_boundaries(prop_stats, prop_path)
                boundaries.update(sub_boundaries)
                
        elif stats_obj.get("type") == "array" and "sample_elements" in stats_obj:
            # Process array elements (limited to samples)
            for i, elem_stats in enumerate(stats_obj["sample_elements"]):
                elem_path = f"{path}[{i}]"
                sub_boundaries = self._collect_boundaries(elem_stats, elem_path)
                boundaries.update(sub_boundaries)
                
        return boundaries

# Example usage function
def main():
    analyzer = JSONAnalyzerAgent(z_threshold=2.0)
    
    # Example 1: Direct JSON input
    print("Example 1: Enter JSON directly")
    json_input = input("Enter JSON data (or press Enter to use sample data): ")
    
    if not json_input.strip():
        # Sample data with some anomalies
        sample_data = {
            "temperatures": [22.1, 22.3, 22.0, 21.9, 22.2, 35.7, 22.1],
            "user_info": {
                "name": "John Doe",
                "age": 30,
                "email": "john@example.com",
                "active": True
            },
            "readings": [
                {"sensor_id": 1, "value": 345, "timestamp": "2025-04-28T14:30:00"},
                {"sensor_id": 2, "value": 347, "timestamp": "2025-04-28T14:35:00"},
                {"sensor_id": 3, "value": 352, "timestamp": "2025-04-28T14:40:00"},
                {"sensor_id": 4, "value": 12,  "timestamp": "2025-04-28T14:45:00"},
                {"sensor_id": 5, "value": 348, "timestamp": "2025-04-28T14:50:00"}
            ]
        }
        json_input = json.dumps(sample_data)
        print(f"Using sample data: {json_input}")
    
    if analyzer.load_json(json_input):
        analyzer.analyze_data()
        print("\n" + analyzer.generate_report())
    else:
        print("Failed to load JSON. Please check the format and try again.")

if __name__ == "__main__":
    main()