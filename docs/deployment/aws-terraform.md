# AWS Environment Setup — Terraform Guide

This guide provisions the **complete** CertGym AWS infrastructure from scratch using
the Terraform modules in `infra/`. One `terraform apply` creates everything:
VPC, RDS, ElastiCache, ECR, IAM roles, ECS cluster + service, ALB, S3, and CloudFront.

**Estimated time:** 30 minutes hands-on + ~15 minutes waiting for AWS to provision.

---

## What Terraform creates

```
infra/
├── main.tf           → VPC, subnets, NAT gateways, security groups, CloudWatch logs
├── rds.tf            → RDS PostgreSQL 16, DB password, Secrets Manager entries
├── elasticache.tf    → ElastiCache Redis 7 (replication group)
├── ecr.tf            → ECR repository with lifecycle policy
├── iam.tf            → ecsTaskExecutionRole, ecsTaskRole, GitHub OIDC deploy role
├── alb.tf            → Application Load Balancer, target group, HTTP listener
├── ecs.tf            → ECS cluster, service task def, migration task def, ECS service
└── s3_cloudfront.tf  → S3 bucket (frontend), CloudFront distribution (SPA + API proxy)
```

---

## Prerequisites

### 1. Install required tools

```bash
# Terraform (already installed)
terraform version   # must be >= 1.0

# AWS CLI
brew install awscli
aws --version

# (Optional) Generate secrets
openssl version
```

### 2. Configure AWS credentials

You need an IAM user or role with enough permissions to create all these resources.
The easiest approach for initial setup is an admin-level user.

```bash
aws configure
# AWS Access Key ID:     <your key>
# AWS Secret Access Key: <your secret>
# Default region name:   us-east-1
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
Generate them now and keep them somewhere safe (e.g. 1Password):

```bash
echo "JWT_SECRET:            $(openssl rand -base64 32)"
echo "JWT_REFRESH_SECRET:    $(openssl rand -base64 32)"
echo "LLM_ENCRYPTION_SECRET: $(openssl rand -base64 32)"
```

Copy the three values — you'll paste them into `terraform.tfvars` next.

---

## Step 2 — Configure terraform.tfvars

```bash
cd infra/
cp terraform.tfvars.example terraform.tfvars
```

Open `terraform.tfvars` and fill in your values:

```hcl
# ── Environment ───────────────────────────────
aws_region  = "us-east-1"
environment = "staging"
app_name    = "braingym"

# ── Sizing (staging — keep small) ─────────────
db_instance_class   = "db.t3.micro"
redis_node_type     = "cache.t3.micro"
ecs_task_cpu        = "512"
ecs_task_memory     = "1024"
ecs_desired_count   = 1

# ── GitHub ────────────────────────────────────
github_repo          = "thanhpt-25/brain-gym"   # ← your GitHub org/repo
create_oidc_provider = true                       # set false if already exists

# ── Secrets (paste values from Step 1) ────────
jwt_secret            = "paste-your-value-here"
jwt_refresh_secret    = "paste-your-value-here"
llm_encryption_secret = "paste-your-value-here"

# ── Tags ──────────────────────────────────────
common_tags = {
  ManagedBy   = "Terraform"
  Environment = "staging"
  Project     = "BrainGym"
}
```

> ⚠️ `terraform.tfvars` is already in `.gitignore` — it will **never** be committed.

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

> This downloads the AWS provider (~50MB). Only needed once per machine.

---

## Step 4 — Preview the plan

```bash
terraform plan
```

Review the output. You should see **~45–55 resources** to be created.
Key things to check:
- `aws_vpc.main` — VPC with correct CIDR `10.0.0.0/16`
- `aws_db_instance.postgres` — engine `postgres`, version `16`
- `aws_elasticache_replication_group.redis` — engine `redis`, version `7.0`
- `aws_ecs_cluster.main` — name `braingym-staging`
- `aws_cloudfront_distribution.main` — two origins (S3 + ALB)
- `aws_iam_role.github_deploy` — OIDC trust for `thanhpt-25/brain-gym`

If anything looks wrong, fix `terraform.tfvars` before continuing.

---

## Step 5 — Apply

```bash
terraform apply
```

Type `yes` when prompted. Terraform provisions resources in dependency order.

**Progress timeline:**
| Time | What's happening |
|------|-----------------|
| 0–2 min | VPC, subnets, security groups, ECR, IAM roles created |
| 2–5 min | NAT gateways provisioning (slow) |
| 5–15 min | RDS PostgreSQL provisioning (slowest) |
| 5–10 min | ElastiCache Redis provisioning |
| 10–15 min | ALB, ECS cluster, task definitions, ECS service created |
| 15–25 min | CloudFront distribution deploying globally |

> ☕ Total wait time is ~15–25 minutes. You can continue to Step 6 while it runs.

---

## Step 6 — Save outputs

When `terraform apply` completes, capture all outputs:

```bash
terraform output
```

You will see values like:

```
alb_dns_name                      = "braingym-staging-xxxx.us-east-1.elb.amazonaws.com"
cloudfront_distribution_id        = "E1ABC2DEF3GHI4"
cloudfront_domain_name            = "d1xxxxxxxxxxxx.cloudfront.net"
ecr_repository_url                = "123456789.dkr.ecr.us-east-1.amazonaws.com/braingym-backend"
ecs_cluster_name                  = "braingym-staging"
ecs_service_name                  = "braingym-backend"
ecs_task_definition_family        = "braingym-backend"
ecs_migrate_task_definition_family= "braingym-backend-migrate"
github_deploy_role_arn            = "arn:aws:iam::123456789:role/braingym-deploy-staging"
private_subnet_ids                = ["subnet-cccc", "subnet-dddd"]
ecs_security_group_id             = "sg-xxxxxxxx"
s3_bucket_name                    = "braingym-staging-frontend"
vpc_id                            = "vpc-xxxxxxxx"
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
| `AWS_ACCOUNT_ID` | Run: `aws sts get-caller-identity --query Account --output text` |
| `AWS_ROLE_ARN` | `terraform output github_deploy_role_arn` |
| `AWS_S3_BUCKET` | `terraform output s3_bucket_name` → `braingym-staging-frontend` |
| `AWS_CLOUDFRONT_DISTRIBUTION_ID` | `terraform output cloudfront_distribution_id` |
| `AWS_PRIVATE_SUBNET_IDS` | `terraform output -json private_subnet_ids \| jq -r 'join(",")'` |
| `AWS_ECS_SECURITY_GROUP` | `terraform output ecs_security_group_id` |
| `VITE_API_BASE_URL` | `https://$(terraform output -raw cloudfront_domain_name)/api/v1` |
| `DEPLOYMENT_ENDPOINT` | `https://$(terraform output -raw cloudfront_domain_name)` |

> **Tip:** Run this one-liner to print all values ready to paste:
> ```bash
> cd infra && \
> echo "AWS_ACCOUNT_ID:                   $(aws sts get-caller-identity --query Account --output text)" && \
> echo "AWS_ROLE_ARN:                     $(terraform output -raw github_deploy_role_arn)" && \
> echo "AWS_S3_BUCKET:                    $(terraform output -raw s3_bucket_name)" && \
> echo "AWS_CLOUDFRONT_DISTRIBUTION_ID:   $(terraform output -raw cloudfront_distribution_id)" && \
> echo "AWS_PRIVATE_SUBNET_IDS:           $(terraform output -json private_subnet_ids | jq -r 'join(",")')" && \
> echo "AWS_ECS_SECURITY_GROUP:           $(terraform output -raw ecs_security_group_id)" && \
> echo "VITE_API_BASE_URL:                https://$(terraform output -raw cloudfront_domain_name)/api/v1" && \
> echo "DEPLOYMENT_ENDPOINT:              https://$(terraform output -raw cloudfront_domain_name)"
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
| `build-push-backend` | Builds Docker image, pushes to ECR | ~3–5 min |
| `migrate-db` | Runs `prisma migrate deploy` via one-off ECS task | ~2–3 min |
| `deploy-backend` | Updates ECS service, waits for stable | ~3–5 min |
| `deploy-frontend` | Builds React, syncs to S3, invalidates CloudFront | ~2–3 min |
| `smoke-test` | HTTP health check on CloudFront endpoint | ~1 min |

---

## Step 9 — Verify

```bash
CF_DOMAIN=$(cd infra && terraform output -raw cloudfront_domain_name)

# API health check
curl -s https://$CF_DOMAIN/api/v1/health

# Frontend (should return HTML)
curl -sI https://$CF_DOMAIN | grep "HTTP/"

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

create_oidc_provider = false  # already created by staging apply
```

Use a separate Terraform state for production:
```bash
# Initialize with a different state key
terraform init \
  -backend-config="key=braingym-production.tfstate"

terraform apply -var-file="terraform.prod.tfvars"
```

Then add a `production` environment in GitHub with the production outputs,
and enable **required reviewers** so every production deploy needs approval.

---

## Useful commands

```bash
# See what changed without applying
terraform plan

# Re-run apply after config changes
terraform apply

# Show current state
terraform show

# See all outputs
terraform output

# Destroy everything (staging only — never production without backup)
terraform destroy

# Import an existing resource (e.g. OIDC provider already exists)
terraform import aws_iam_openid_connect_provider.github[0] \
  arn:aws:iam::YOUR_ACCOUNT:oidc-provider/token.actions.githubusercontent.com
```

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `Error: creating OIDC provider: already exists` | OIDC provider exists from another environment | Set `create_oidc_provider = false` in `terraform.tfvars` and import: `terraform import aws_iam_openid_connect_provider.github[0] <arn>` |
| `Error: bucket already exists` | S3 bucket name taken globally | Change `app_name` or add a suffix to the bucket name in `s3_cloudfront.tf` |
| `Error: InvalidParameterException` on ECS service | ECS service can't find task def | Usually a race condition — re-run `terraform apply` |
| CloudFront returns `403 Access Denied` from S3 | OAC bucket policy not applied yet | Wait a few minutes and retry — Terraform applies the policy but CloudFront can take time to propagate |
| GitHub Actions: `Could not assume role` | `github_repo` mismatch in trust policy | Verify `github_repo` in `terraform.tfvars` exactly matches `owner/repo` in GitHub |
| `Error: Invalid count argument` on `aws_iam_openid_connect_provider` | `create_oidc_provider` is `false` but provider not imported | Either set `true` or import the existing provider (see command above) |
