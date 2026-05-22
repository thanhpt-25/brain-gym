# Infrastructure as Code (Terraform)

This directory contains Terraform code to provision CertGym infrastructure on AWS.

## Structure

```
infra/
├── variables.tf           # Input variables
├── main.tf               # VPC, subnets, security groups, logging
├── rds.tf                # PostgreSQL database
├── elasticache.tf        # Redis cluster
├── ecr.tf                # ECR repository for Docker images
├── outputs.tf            # Outputs and setup instructions
├── terraform.tfvars.example  # Example variables (rename to terraform.tfvars)
└── README.md             # This file
```

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **Terraform** >= 1.0 installed
3. **AWS CLI** configured with credentials
4. **GitHub repository** for CI/CD

## Quick Start

### 1. Set up variables

```bash
cd infra/

# Copy and edit the example
cp terraform.tfvars.example terraform.tfvars

# Edit for your environment
nano terraform.tfvars
```

### 2. Initialize Terraform

```bash
terraform init
```

### 3. Plan and apply

```bash
# Review changes
terraform plan

# Apply (press "yes" when prompted)
terraform apply
```

This will create:
- **VPC** with 2 public + 2 private subnets
- **NAT Gateways** for private subnet internet access
- **RDS PostgreSQL 16** in private subnets
- **ElastiCache Redis 7** in private subnets
- **ECR repository** for backend Docker images
- **Security groups** with proper networking rules
- **CloudWatch logs** for ECS

### 4. Capture outputs

```bash
# Display all outputs
terraform output

# Save for GitHub setup
terraform output -json > ../terraform-output.json
```

Use the output values to populate GitHub Environment Secrets (see `DEPLOYMENT_AWS.md`).

---

## Staging vs. Production

The same Terraform code works for both environments. Key differences:

| Aspect | Staging | Production |
|--------|---------|-----------|
| `environment` | `staging` | `production` |
| RDS Instance | `db.t3.micro` | `db.t3.small+` |
| RDS Multi-AZ | `false` | `true` |
| Redis Node Type | `cache.t3.micro` | `cache.r6g.large+` |
| Redis Nodes | `1` | `2-3` with cluster |
| ECS Tasks | `1` | `2-3` |
| Backup Retention | `7` days | `30` days |
| Encryption | KMS (auto) | KMS (auto) |

To deploy production, create a new state and tfvars:

```bash
# Staging (already done)
terraform apply -var-file=terraform.tfvars

# Production (separate state)
mkdir -p ../terraform-prod
cp terraform.tfvars ../terraform-prod/terraform.tfvars
# Edit ../terraform-prod/terraform.tfvars, set environment = "production"
cd ../terraform-prod
terraform init -backend-config="key=braingym-prod.tfstate"
terraform apply -var-file=terraform.tfvars
```

---

## State Management

By default, state is stored locally (`terraform.tfstate`). **For production, use remote state:**

```bash
# Enable S3 + DynamoDB remote state
terraform {
  backend "s3" {
    bucket         = "braingym-terraform-state"
    key            = "braingym-staging.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

# Before apply:
terraform init
```

---

## Secrets Management

Terraform auto-creates some secrets in AWS Secrets Manager:
- `braingym/{environment}/database-url`
- `braingym/{environment}/db-password`

You **must manually create** (or pass via env):
- `braingym/{environment}/jwt-secret`
- `braingym/{environment}/jwt-refresh-secret`
- `braingym/{environment}/llm-encryption-secret`

Example:

```bash
aws secretsmanager create-secret \
  --name braingym/staging/jwt-secret \
  --secret-string "$(openssl rand -base64 32)"

aws secretsmanager create-secret \
  --name braingym/staging/jwt-refresh-secret \
  --secret-string "$(openssl rand -base64 32)"

aws secretsmanager create-secret \
  --name braingym/staging/llm-encryption-secret \
  --secret-string "$(openssl rand -base64 32)"
```

---

## Destroying Infrastructure

⚠️ **Be careful!** This deletes all resources including the database.

```bash
# View what will be deleted
terraform plan -destroy

# Destroy (you'll be prompted for confirmation)
terraform destroy
```

For production, enable deletion protection:
```bash
aws rds modify-db-instance \
  --db-instance-identifier braingym-production \
  --deletion-protection
```

---

## Troubleshooting

### Error: "No valid credential sources found"
Ensure AWS credentials are configured:
```bash
aws configure
# or set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN
```

### RDS creation fails: "Invalid security group"
Ensure the security groups are created first:
```bash
terraform apply -target aws_security_group.rds
terraform apply
```

### ElastiCache AUTH token rejected
If Redis auth token contains special characters, Terraform may escape them differently. Use:
```bash
terraform import aws_elasticache_cluster.redis braingym-staging
```

---

## Next Steps

1. ✅ Infrastructure provisioned (this step)
2. Set up ECS cluster, task definitions, ALB (manual or via additional Terraform)
3. Set up S3 + CloudFront for frontend
4. Configure GitHub OIDC role and secrets
5. Deploy via GitHub Actions (`deploy.yml`)

See `../DEPLOYMENT_AWS.md` for full setup instructions.

