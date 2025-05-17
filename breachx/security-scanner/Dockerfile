FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install base dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    wget \
    curl \
    git \
    unzip \
    openssl \
    nmap \
    openjdk-11-jre-headless \
    perl \
    jq \
    build-essential \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Install AWS CLI v2
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "/tmp/awscliv2.zip" && \
    unzip /tmp/awscliv2.zip -d /tmp && \
    /tmp/aws/install && \
    rm -rf /tmp/aws /tmp/awscliv2.zip

# Create directories
RUN mkdir -p /tools /reports

# ----------------------------------
# TOOL 1: SQLMap
RUN git clone --depth 1 https://github.com/sqlmapproject/sqlmap.git /tools/sqlmap

# TOOL 2: testssl.sh
RUN git clone --depth 1 https://github.com/drwetter/testssl.sh.git /tools/testssl

# TOOL 3: SSRFmap
RUN git clone --depth 1 https://github.com/swisskyrepo/SSRFmap /tools/ssrfmap && \
    pip3 install -r /tools/ssrfmap/requirements.txt

# TOOL 4: Nikto
RUN git clone --depth 1 https://github.com/sullo/nikto.git /tools/nikto

# TOOL 5: JWT Tool
RUN git clone --depth 1 https://github.com/ticarpi/jwt_tool /tools/jwt_tool && \
    pip3 install -r /tools/jwt_tool/requirements.txt

# TOOL 6: Trivy
RUN curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin

# TOOL 7: XSStrike
RUN git clone --depth 1 https://github.com/s0md3v/XSStrike /tools/xsstrike && \
    pip3 install -r /tools/xsstrike/requirements.txt

# ----------------------------------
# Copy scan script using HEREDOC without interpolating variables prematurely
COPY <<-"EOF" /scan.sh
#!/bin/bash

set -e

mkdir -p /reports/sqlmap /reports/testssl /reports/ssrfmap /reports/nikto /reports/jwt /reports/trivy /reports/nmap /reports/xss

TARGET_URL="${1:-$TARGET_URL}"

if [ -z "$TARGET_URL" ]; then
    echo "❌ No TARGET_URL provided"
    exit 1
fi

echo "🔍 Scanning $TARGET_URL at $(date)"

run_tool() {
    local name="$1"
    local cmd="$2"
    echo -e "\n🚀 Starting $name scan..."
    start=$(date +%s)
    eval "$cmd"
    status=$?
    duration=$(( $(date +%s) - start ))
    if [ $status -eq 0 ]; then
        echo "✅ $name completed in ${duration}s"
    else
        echo "⚠️ $name failed (exit $status, ${duration}s)"
    fi
}

run_tool "SQLMap" "python3 /tools/sqlmap/sqlmap.py -u \$TARGET_URL --forms --batch --output-dir=/reports/sqlmap"
run_tool "testssl.sh" "cd /tools/testssl && ./testssl.sh --quiet --json /reports/testssl/report.json \$TARGET_URL"
run_tool "SSRFmap" "cd /tools/ssrfmap && echo \"URL: \$TARGET_URL\" > /tmp/request.txt && python3 ssrfmap.py -r /tmp/request.txt -p url -m readfiles > /reports/ssrfmap/report.txt"
run_tool "Nikto" "cd /tools/nikto/program && perl nikto.pl -h \$TARGET_URL -Format json -output /reports/nikto/report.json"
run_tool "JWT_Tool" "cd /tools/jwt_tool && python3 jwt_tool.py -M at -u \$TARGET_URL -o /reports/jwt/report.txt"
run_tool "Trivy" "trivy fs --quiet --format json --output /reports/trivy/report.json /"
run_tool "Nmap" "TARGET_HOST=\$(echo \$TARGET_URL | sed -e 's|^[^/]*//||' -e 's|/.*$||') && nmap -sV --script vuln \$TARGET_HOST -oN /reports/nmap/report.txt"
run_tool "XSStrike" "cd /tools/xsstrike && python3 xsstrike.py -u \$TARGET_URL --crawl --skip --output /reports/xss/report.json"

cat > /reports/summary.json <<SUMMARY
{
  "target_url": "$TARGET_URL",
  "date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "reports": {
    "sqlmap": "/reports/sqlmap",
    "testssl": "/reports/testssl/report.json",
    "ssrfmap": "/reports/ssrfmap/report.txt",
    "nikto": "/reports/nikto/report.json",
    "jwt": "/reports/jwt/report.txt",
    "trivy": "/reports/trivy/report.json",
    "nmap": "/reports/nmap/report.txt",
    "xss": "/reports/xss/report.json"
  }
}
SUMMARY

echo "✅ All scans complete. Reports saved to /reports"

# Upload reports to S3 if AWS credentials are available
if [ ! -z "$AWS_ACCESS_KEY_ID" ] && [ ! -z "$AWS_SECRET_ACCESS_KEY" ]; then
    echo "📤 Uploading reports to S3..."
    TIMESTAMP=$(date +%s)
    aws s3 cp /reports "s3://security-scan-reports-breachx/reports/$TIMESTAMP/" --recursive
    echo "✅ Reports uploaded to S3"
fi
EOF

# Make the scan script executable
RUN chmod +x /scan.sh

# Default entrypoint
ENTRYPOINT ["/scan.sh"]
