#!/bin/bash
# setup-aws-codebuild.sh
# This script sets up the AWS infrastructure needed for the CodeBuild integration

# Exit on error
set -e

# Check for AWS CLI
if ! command -v aws &> /dev/null; then
  echo "AWS CLI not found. Please install it first."
  exit 1
fi

# Set variables
AWS_REGION=${AWS_REGION:-"us-east-1"}
PROJECT_NAME=${PROJECT_NAME:-"repository-builder"}
ROLE_NAME="${PROJECT_NAME}-service-role"
LOGS_GROUP_NAME="codebuild-logs"

echo "Setting up AWS infrastructure for CodeBuild integration in region ${AWS_REGION}..."

# Create IAM role for CodeBuild
echo "Creating IAM role for CodeBuild..."
TRUST_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "codebuild.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
)

# Create role
aws iam create-role \
  --role-name ${ROLE_NAME} \
  --assume-role-policy-document "${TRUST_POLICY}" \
  --region ${AWS_REGION}

# Attach necessary policies
echo "Attaching policies to the IAM role..."

# Policy for CloudWatch Logs
aws iam attach-role-policy \
  --role-name ${ROLE_NAME} \
  --policy-arn arn:aws:iam::aws:policy/CloudWatchLogsFullAccess \
  --region ${AWS_REGION}

# Policy for CodeBuild
aws iam attach-role-policy \
  --role-name ${ROLE_NAME} \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess \
  --region ${AWS_REGION}

# Policy for ECR (for Docker)
aws iam attach-role-policy \
  --role-name ${ROLE_NAME} \
  --policy-arn arn:aws:iam::aws:policy/AmazonECR-FullAccess \
  --region ${AWS_REGION}

# Create custom inline policy for additional permissions
INLINE_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "codebuild:CreateReportGroup",
        "codebuild:CreateReport",
        "codebuild:UpdateReport",
        "codebuild:BatchPutTestCases"
      ],
      "Resource": "*"
    }
  ]
}
EOF
)

aws iam put-role-policy \
  --role-name ${ROLE_NAME} \
  --policy-name "${PROJECT_NAME}-additional-permissions" \
  --policy-document "${INLINE_POLICY}" \
  --region ${AWS_REGION}

# Create CloudWatch Logs group
echo "Creating CloudWatch Logs group..."
aws logs create-log-group \
  --log-group-name ${LOGS_GROUP_NAME} \
  --region ${AWS_REGION}

# Get role ARN
ROLE_ARN=$(aws iam get-role --role-name ${ROLE_NAME} --query "Role.Arn" --output text --region ${AWS_REGION})

echo "AWS infrastructure setup complete!"
echo "-----------------------------------------------------"
echo "CodeBuild service role ARN: ${ROLE_ARN}"
echo "CloudWatch Logs group: ${LOGS_GROUP_NAME}"
echo ""
echo "Add the following to your .env file:"
echo "CODEBUILD_SERVICE_ROLE_ARN=${ROLE_ARN}"
echo "AWS_REGION=${AWS_REGION}"
echo "Don't forget to also set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY"
echo "-----------------------------------------------------"