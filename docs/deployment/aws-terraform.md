# AWS Environment Setup — Terraform Guide

This guide provisions the complete CertGym AWS infrastructure from scratch using
the Terraform configuration in `infra/`. One `terraform apply` creates everything:
VPC, RDS, ElastiCache, ECR repositories, IAM roles, ECS cluster + service, ALB,
S3 buckets, CloudFront, Route53, ACM certificate, and Lambda.

**Estimated time:** 30 minutes hands-on + ~15 minutes waiting for AWS to provision.

---

## What Terraform creates

```
infra/
├── providers.tf      → AWS provider (primary region + us-east-1 alias for ACM)
├── terraform.tf      → required_version >= 1.0, AWS provider ~> 5.0
├── variables.tf      → all input variables with defaults
├── locals.tf         → database_url construction, app_secrets map, OIDC ARN, CloudFront hosted zone ID
├── main.tf           → VPC, subnets, NAT gateway, security groups, CloudWatch log group
├── rds.tf            → RDS PostgreSQL 16, random password, Secrets Manager entries
├── elasticache.tf    → ElastiCache Redis 7 replication group, SNS alerts topic (production)
├── ecr.tf            → ECR repository (braingym-backend) with lifecycle policy
├── lambda.tf         → ECR repository (braingym-markitdown), Lambda function, IAM execution role
├── iam.tf            → ECS execution role, ECS task role, GitHub OIDC deploy role
├── alb.tf            → Application Load Balancer, target group, HTTP listener
├── ecs.tf            → ECS cluster, service task definition, migration task definition, ECS service
├── s3_cloudfront.tf  → S3 frontend + avatars buckets, CloudFront distribution (3 origins + OAC)
├── s3_materials.tf   → S3 materials-tmp bucket with 24 h lifecycle rule
├── dns.tf            → Route53 hosted zone, ACM certificate, DNS validation records, alias records
└── outputs.tf        → VPC, subnet, SG, RDS, Redis, ECR, ECS, CloudFront, GitHub secrets outputs
```

---

## Prerequisites

### 1. Install required tools

```bash
# Terraform
terraform version   # must be >= 1.0

# AWS CLI
brew install awscli
aws --version

# Generate secrets
openssl version
```

### 2. Configure AWS credentials

You need an IAM user or role with permissions to create all these resources.
An admin-level IAM user is simplest for initial setup.

```bash
aws configure
# AWS Access Key ID:     <your key>
# AWS Secret Access Key: <your secret>
# Default region name:   ap-southeast-1
# Default output format: json
```

Verify it works:
```bash
aws sts get-caller-identity
# Should print your account ID and user/role ARN
```

---

## Step 1 — Generate secrets

You need three random secrets before running Terraform.
Generate them now and store them securely (for example, in a password manager):

```bash
echo "JWT_SECRET:            $(openssl rand -base64 32)"
echo "JWT_REFRESH_SECRET:    $(openssl rand -base64 32)"
echo "LLM_ENCRYPTION_SECRET: $(openssl rand -base64 32)"
```

Copy the three values — you will paste them into `terraform.tfvars` in the next step.

---

## Step 2 — Configure terraform.tfvars

```bash
cd infra/
```

Create `terraform.tfvars` (this file is gitignored — it will never be committed):

```hcl
# ── Environment ───────────────────────────────
aws_region  = "ap-southeast-1"
environment = "staging"
app_name    = "braingym"

# ── Domain ────────────────────────────────────
domain_name = "brain-gym.biz"

# ── Sizing (staging — keep small) ─────────────
db_instance_class            = "db.t3.micro"
db_allocated_storage         = 20
db_backup_retention_period   = 7
db_multi_az                  = false
redis_node_type              = "cache.t3.micro"
redis_num_cache_nodes        = 1
redis_transit_encryption     = false
ecs_task_cpu                 = "512"
ecs_task_memory              = "1024"
ecs_desired_count            = 1

# ── GitHub OIDC ───────────────────────────────
github_repo          = "thanhpt-25/brain-gym"
create_oidc_provider = true   # set false if already exists in this account

# ── Secrets (paste values from Step 1) ────────
jwt_secret            = "paste-your-value-here"
jwt_refresh_secret    = "paste-your-value-here"
llm_encryption_secret = "paste-your-value-here"

# ── DDS feature flag ──────────────────────────
dds_shadow_mode = "false"

# ── Tags ──────────────────────────────────────
common_tags = {
  ManagedBy   = "Terraform"
  Environment = "staging"
  Project     = "BrainGym"
}
```

> `terraform.tfvars` is in `.gitignore` — it will never be committed.

---

## Step 3 — Initialize Terraform

```bash
cd infra/   # if not already there
terraform init
```

Expected output:
```
Terraform has been successfully initialized!
```

> This downloads the AWS provider (~50 MB). Only needed once per machine or after provider upgrades.

---

## Step 4 — Preview the plan

```bash
terraform plan
```

Review the output. You should see approximately 55–65 resources to be created.
Key resources to verify:

| Resource | Expected value |
|---|---|
| `aws_vpc.main` | CIDR `10.0.0.0/16` |
| `aws_db_instance.postgres` | engine `postgres`, version `16` |
| `aws_elasticache_replication_group.redis` | engine `redis`, version `7.0` |
| `aws_ecs_cluster.main` | name `braingym-staging` |
| `aws_cloudfront_distribution.main` | three origins: `s3-frontend`, `s3-avatars`, `alb-backend` |
| `aws_iam_role.github_deploy` | OIDC trust for `thanhpt-25/brain-gym` |
| `aws_lambda_function.markitdown` | function `braingym-staging-markitdown` |
| `aws_route53_zone.main` | zone for `brain-gym.biz` |

If anything looks wrong, fix `terraform.tfvars` before continuing.

---

## Step 5 — Apply

```bash
terraform apply
```

Type `yes` when prompted. Terraform provisions resources in dependency order.

**Progress timeline:**

| Time | What is happening |
|------|-----------------|
| 0–2 min | VPC, subnets, security groups, ECR repositories, IAM roles created |
| 2–5 min | NAT gateway provisioning |
| 5–15 min | RDS PostgreSQL provisioning (slowest) |
| 5–10 min | ElastiCache Redis provisioning |
| 10–15 min | ALB, ECS cluster, task definitions, Lambda, ECS service created |
| 15–25 min | CloudFront distribution deploying globally |

> Total wait time is approximately 15–25 minutes.

---

## Step 5b — Configure DNS delegation (required for custom domain)

After `terraform apply` completes, copy the Route53 name servers to your domain registrar:

```bash
terraform output route53_name_servers
```

Log in to your domain registrar (wherever `brain-gym.biz` is registered) and replace
the nameservers with the four values printed above. DNS propagation typically takes
5–30 minutes; ACM certificate validation and CloudFront alias resolution both require
this to complete.

> If the registrar nameservers are not updated, `aws_acm_certificate_validation.cdn`
> will time out and the Terraform apply will fail at the DNS validation step. In that
> case, run `terraform apply` again after propagation.

---

## Step 6 — Save outputs

When `terraform apply` completes, capture all outputs:

```bash
terraform output
```

You will see values like:

```
alb_dns_name                         = "braingym-staging-xxxx.ap-southeast-1.elb.amazonaws.com"
cloudfront_distribution_id           = "E1ABC2DEF3GHI4"
cloudfront_domain_name               = "d1xxxxxxxxxxxx.cloudfront.net"
custom_domain_url                    = "https://brain-gym.biz"
ecr_repository_url                   = "123456789.dkr.ecr.ap-southeast-1.amazonaws.com/braingym-backend"
ecs_cluster_name                     = "braingym-staging"
ecs_migrate_task_definition_family   = "braingym-backend-migrate"
ecs_service_name                     = "braingym-backend"
ecs_task_definition_family           = "braingym-backend"
ecs_security_group_id                = "sg-xxxxxxxx"
github_deploy_role_arn               = "arn:aws:iam::123456789:role/braingym-deploy-staging"
markitdown_ecr_repository_url        = "123456789.dkr.ecr.ap-southeast-1.amazonaws.com/braingym-markitdown"
markitdown_lambda_arn                = "arn:aws:lambda:ap-southeast-1:123456789:function:braingym-staging-markitdown"
private_subnet_ids                   = ["subnet-cccc", "subnet-dddd"]
redis_endpoint                       = "braingym-staging.xxxx.ng.0001.apse1.cache.amazonaws.com"
rds_endpoint                         = "braingym-staging.xxxx.ap-southeast-1.rds.amazonaws.com:5432"
route53_name_servers                 = ["ns-xxxx.awsdns-xx.com", ...]
s3_avatars_bucket_name               = "braingym-staging-avatars"
s3_bucket_name                       = "braingym-staging-frontend"
s3_materials_tmp_bucket_name         = "braingym-staging-materials-tmp"
vpc_id                               = "vpc-xxxxxxxx"
```

Save the JSON version for easy reference:
```bash
terraform output -json > ../terraform-output.json
```

---

## Step 7 — Configure GitHub Environment Secrets

1. Go to `https://github.com/thanhpt-25/brain-gym/settings/environments`
2. Click **New environment** → name it `staging` → **Configure environment**
3. Under **Environment secrets**, click **Add secret** for each value below:

| Secret Name | Where to get the value |
|-------------|----------------------|
| `AWS_ACCOUNT_ID` | `aws sts get-caller-identity --query Account --output text` |
| `AWS_ROLE_ARN` | `terraform output -raw github_deploy_role_arn` |
| `AWS_S3_BUCKET` | `terraform output -raw s3_bucket_name` |
| `AWS_CLOUDFRONT_DISTRIBUTION_ID` | `terraform output -raw cloudfront_distribution_id` |
| `AWS_PRIVATE_SUBNET_IDS` | `terraform output -json private_subnet_ids \| jq -r 'join(",")'` |
| `AWS_ECS_SECURITY_GROUP` | `terraform output -raw ecs_security_group_id` |
| `VITE_API_BASE_URL` | `https://brain-gym.biz/api/v1` |
| `DEPLOYMENT_ENDPOINT` | `https://brain-gym.biz` |
| `VITE_GOOGLE_CLIENT_ID` | Your Google OAuth client ID |

> Run this one-liner to print all values ready to paste:
> ```bash
> cd infra && \
> echo "AWS_ACCOUNT_ID:                   $(aws sts get-caller-identity --query Account --output text)" && \
> echo "AWS_ROLE_ARN:                     $(terraform output -raw github_deploy_role_arn)" && \
> echo "AWS_S3_BUCKET:                    $(terraform output -raw s3_bucket_name)" && \
> echo "AWS_CLOUDFRONT_DISTRIBUTION_ID:   $(terraform output -raw cloudfront_distribution_id)" && \
> echo "AWS_PRIVATE_SUBNET_IDS:           $(terraform output -json private_subnet_ids | jq -r 'join(",\")')" && \
> echo "AWS_ECS_SECURITY_GROUP:           $(terraform output -raw ecs_security_group_id)"
> ```

---

## Step 8 — First deployment

Trigger the pipeline by pushing to `main`:

```bash
git checkout main
git commit --allow-empty -m "chore: trigger first staging deploy"
git push origin main
```

Go to **GitHub → Actions** and watch the **Deploy** workflow:

| Job | What it does | Expected duration |
|-----|-------------|-------------------|
| `build-push-backend` | Builds Docker image, pushes to ECR `braingym-backend` | ~3–5 min |
| `build-push-lambda` | Builds Markitdown image, pushes to ECR `braingym-markitdown`, updates Lambda | ~3–5 min |
| `migrate-db` | Registers SHA-pinned migrate task def, runs one-off Fargate task | ~2–3 min |
| `deploy-backend` | Renders SHA-pinned service task def, updates ECS service, waits for stability | ~3–5 min |
| `deploy-frontend` | Builds React with Vite, syncs to S3, invalidates CloudFront | ~2–3 min |
| `smoke-test` | HTTP health check on `DEPLOYMENT_ENDPOINT/api/v1/health` | ~1 min |

---

## Step 9 — Verify

```bash
# API health check (via custom domain after DNS propagates, or CloudFront domain)
curl -s https://brain-gym.biz/api/v1/health

# Frontend (should return HTML)
curl -sI https://brain-gym.biz | grep "HTTP/"

# ECS service status
aws ecs describe-services \
  --cluster braingym-staging \
  --services braingym-backend \
  --query 'services[0].{status:status,running:runningCount,desired:desiredCount}'

# Live backend logs
aws logs tail /ecs/braingym-backend --follow
```

---

## Production setup

Repeat Steps 1–9 with a separate `terraform.tfvars` for production.

Create `infra/terraform.prod.tfvars`:
```hcl
aws_region  = "ap-southeast-1"
environment = "production"

# Production sizing
db_instance_class            = "db.t3.small"
db_multi_az                  = true
db_backup_retention_period   = 30
redis_node_type              = "cache.r6g.large"
redis_num_cache_nodes        = 2
ecs_desired_count            = 2

# New secrets for production (generate fresh values)
jwt_secret            = "prod-value-here"
jwt_refresh_secret    = "prod-value-here"
llm_encryption_secret = "prod-value-here"

# OIDC provider already created by staging apply
create_oidc_provider = false
```

Use a separate Terraform state for production:
```bash
terraform init \
  -backend-config="key=braingym-production.tfstate"

terraform apply -var-file="terraform.prod.tfvars"
```

Then add a `production` environment in GitHub with the production outputs
and enable **required reviewers** so every production deploy needs approval.

---

## Useful commands

```bash
# See what would change without applying
terraform plan

# Apply changes
terraform apply

# Show current state
terraform show

# See all outputs
terraform output

# Destroy everything (staging only — never production without a database backup)
terraform destroy

# Import an existing OIDC provider (if it already exists in the account)
terraform import 'aws_iam_openid_connect_provider.github[0]' \
  arn:aws:iam::YOUR_ACCOUNT:oidc-provider/token.actions.githubusercontent.com

# Refresh outputs without re-applying
terraform refresh
```

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `Error: creating OIDC provider: already exists` | OIDC provider exists from a previous apply or another environment | Set `create_oidc_provider = false` and import the existing provider (see command above) |
| `Error: bucket already exists` | S3 bucket names are globally unique | Change `app_name` or add a suffix to the bucket name in `s3_cloudfront.tf` or `s3_materials.tf` |
| `Error: InvalidParameterException` on ECS service | ECS service cannot find the task definition | Usually a race condition — re-run `terraform apply` |
| CloudFront returns `403 Access Denied` from S3 | OAC bucket policy not applied yet | Wait a few minutes and retry — CloudFront propagation can take time |
| GitHub Actions `Could not assume role` | `github_repo` mismatch in the trust policy | Verify `github_repo` in `terraform.tfvars` exactly matches `owner/repo` in GitHub |
| ACM certificate validation times out | Registrar nameservers not updated | Update nameservers at your registrar to the Route53 values, wait for propagation, then re-run `terraform apply` |
| `Error: Invalid count argument` on `aws_iam_openid_connect_provider` | `create_oidc_provider = false` but provider not imported | Set `true` or import the existing provider |
