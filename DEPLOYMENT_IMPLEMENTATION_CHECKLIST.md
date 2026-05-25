# CI/CD to AWS — Implementation Checklist

This checklist guides you through deploying CertGym to AWS (ECS Fargate, RDS, ElastiCache, CloudFront).

**Estimated timeline:** 3-5 days (most time is waiting for AWS resources to provision).

---

## Phase 1: Code Preparation ✅ (Already done)

- [x] `backend/docker-entrypoint.sh` refactored for safe migrations
  - Supports `migrate` mode for CI/CD one-off tasks
  - Application startup skips migrations in production
  - Seeding made conditional via `RUN_SEED` env var
- [x] `.github/workflows/deploy.yml` created
  - Builds & pushes backend image to ECR
  - Runs migrations via one-off ECS task
  - Deploys backend ECS service
  - Builds & deploys frontend to S3 + CloudFront
  - Runs smoke tests
- [x] Infrastructure documentation (`DEPLOYMENT_AWS.md`) created
- [x] Terraform starter modules created (`infra/`)

---

## Phase 2: AWS Infrastructure Setup (1-2 days)

### Step 1: OIDC Provider (one-time)
- [ ] Run OIDC setup command (see `DEPLOYMENT_AWS.md`):
  ```bash
  aws iam create-openid-connect-provider \
    --url https://token.actions.githubusercontent.com \
    --client-id-list sts.amazonaws.com \
    --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
  ```
- [ ] Verify OIDC provider exists:
  ```bash
  aws iam list-open-id-connect-providers
  ```

### Step 2: Terraform Infrastructure (staging)
- [ ] Copy `infra/terraform.tfvars.example` to `infra/terraform.tfvars`
- [ ] Edit `terraform.tfvars` for staging (db size, etc.)
- [ ] Initialize Terraform:
  ```bash
  cd infra
  terraform init
  ```
- [ ] Review and apply:
  ```bash
  terraform plan
  terraform apply
  ```
- [ ] Capture outputs:
  ```bash
  terraform output > terraform-output.json
  ```
- [ ] Note the following values (needed for next steps):
  - `vpc_id`
  - `private_subnet_ids`
  - `ecs_security_group_id`
  - `rds_endpoint`
  - `redis_endpoint`
  - `redis_port`

### Step 3: Create Application Secrets in Secrets Manager
- [ ] Create JWT secret:
  ```bash
  aws secretsmanager create-secret \
    --name braingym/staging/jwt-secret \
    --secret-string "$(openssl rand -base64 32)"
  ```
- [ ] Create JWT refresh secret:
  ```bash
  aws secretsmanager create-secret \
    --name braingym/staging/jwt-refresh-secret \
    --secret-string "$(openssl rand -base64 32)"
  ```
- [ ] Create LLM encryption secret:
  ```bash
  aws secretsmanager create-secret \
    --name braingym/staging/llm-encryption-secret \
    --secret-string "$(openssl rand -base64 32)"
  ```
- [ ] Verify all 5 secrets exist:
  ```bash
  aws secretsmanager list-secrets \
    --filters Key=name,Values=braingym/staging
  ```

### Step 4: Create IAM Deploy Role (staging)
- [ ] Create deploy role with OIDC trust (see `DEPLOYMENT_AWS.md` template):
  ```bash
  # Create role with the trust relationship from DEPLOYMENT_AWS.md
  aws iam create-role \
    --role-name braingym-deploy-staging \
    --assume-role-policy-document file://trust-policy.json
  ```
- [ ] Attach inline policy (see `DEPLOYMENT_AWS.md` template):
  ```bash
  aws iam put-role-policy \
    --role-name braingym-deploy-staging \
    --policy-name braingym-deploy-staging \
    --policy-document file://deploy-policy.json
  ```
- [ ] Test OIDC assumption (optional):
  ```bash
  # In GitHub Actions context, roles should be assumable automatically
  ```

### Step 5: Create ECS Cluster & CloudWatch
- [ ] Create ECS cluster:
  ```bash
  aws ecs create-cluster --cluster-name braingym-staging
  ```
- [ ] Create CloudWatch log group (Terraform created this, verify):
  ```bash
  aws logs describe-log-groups --log-group-name-prefix "/ecs/"
  ```

### Step 6: Create ALB & Target Group
- [ ] Create Application Load Balancer:
  ```bash
  aws elbv2 create-load-balancer \
    --name braingym-staging-alb \
    --subnets <public-subnet-ids from terraform> \
    --security-groups <alb-security-group-id>
  ```
- [ ] Create target group:
  ```bash
  aws elbv2 create-target-group \
    --name braingym-staging-tg \
    --protocol HTTP \
    --port 3000 \
    --vpc-id <vpc-id> \
    --health-check-path /api/v1/health \
    --health-check-interval-seconds 30
  ```
- [ ] Attach target group to ALB listener:
  ```bash
  # Create listener on port 80, forward to target group
  aws elbv2 create-listener \
    --load-balancer-arn <alb-arn> \
    --protocol HTTP \
    --port 80 \
    --default-actions Type=forward,TargetGroupArn=<target-group-arn>
  ```
- [ ] Note ALB DNS name for later

### Step 7: Create ECS Task Definition
- [ ] Register task definition (use template from `DEPLOYMENT_AWS.md`):
  ```bash
  aws ecs register-task-definition \
    --cli-input-json file://task-definition.json
  ```
- [ ] Create migration task definition (same as above, for one-off migrate tasks)

### Step 8: Create ECS Service
- [ ] Create service:
  ```bash
  aws ecs create-service \
    --cluster braingym-staging \
    --service-name braingym-backend \
    --task-definition braingym-backend \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=<private-subnets>,securityGroups=<ecs-sg>,assignPublicIp=DISABLED}" \
    --load-balancers targetGroupArn=<target-group-arn>,containerName=braingym-backend,containerPort=3000
  ```

### Step 9: Create S3 Bucket & CloudFront Distribution
- [ ] Create S3 bucket:
  ```bash
  aws s3api create-bucket \
    --bucket braingym-staging-frontend \
    --region us-east-1
  ```
- [ ] Enable block public access:
  ```bash
  aws s3api put-public-access-block \
    --bucket braingym-staging-frontend \
    --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
  ```
- [ ] Create CloudFront distribution with:
  - Origin 1: S3 bucket (with Origin Access Control)
  - Origin 2: ALB (for /api/v1)
  - Behaviors: `/api/v1/*` → ALB, `/` → S3 with SPA error routing
- [ ] Note CloudFront distribution ID for GitHub secrets

---

## Phase 3: GitHub Configuration (30 mins)

### Step 1: Create GitHub Environment (staging)
- [ ] Go to Settings > Environments > New Environment > `staging`
- [ ] Add Environment Secrets:
  ```
  AWS_ACCOUNT_ID = <your-account-id>
  AWS_ROLE_ARN = arn:aws:iam::<account>:role/braingym-deploy-staging
  AWS_S3_BUCKET = braingym-staging-frontend
  AWS_CLOUDFRONT_DISTRIBUTION_ID = <distribution-id>
  AWS_PRIVATE_SUBNET_IDS = <subnet-1>,<subnet-2>
  AWS_ECS_SECURITY_GROUP = <sg-id>
  VITE_API_BASE_URL = https://staging-braingym.example.com/api/v1
  DEPLOYMENT_ENDPOINT = https://staging-braingym.example.com
  ```

### Step 2: Test Deployment
- [ ] Push a commit to `main` branch
- [ ] Monitor `.github/workflows/deploy.yml` in GitHub Actions
- [ ] Watch for:
  - ✓ Build & push backend image
  - ✓ Migration task completes
  - ✓ ECS service updates
  - ✓ Frontend builds and deploys to S3
  - ✓ CloudFront invalidation
  - ✓ Smoke test passes
- [ ] If any step fails, check logs and fix (most common: secrets missing, ALB health check)

### Step 3: Verify Deployment
- [ ] Frontend loads: `https://staging-braingym.example.com`
- [ ] API is reachable: `curl https://staging-braingym.example.com/api/v1/health`
- [ ] Check CloudWatch logs:
  ```bash
  aws logs tail /ecs/braingym-backend --follow
  ```
- [ ] Verify database migrated:
  ```bash
  # SSH into RDS (via bastion) or check via application
  psql postgresql://braingym:PASSWORD@rds-endpoint/braingym?schema=public
  \dt  # List tables
  ```

---

## Phase 4: Production Setup (1 day)

Repeat Phase 2 (Infrastructure) and Phase 3 (GitHub) but with `production` environment.

### Production-Specific Changes:
- [ ] RDS: upgrade to `db.t3.small` or larger, enable Multi-AZ
- [ ] Redis: upgrade to `cache.r6g.large` or larger, enable cluster mode (2-3 nodes)
- [ ] ECS: increase desired task count to 2-3
- [ ] Backups: RDS retention 30 days (vs. 7 for staging)
- [ ] Domain: update `VITE_API_BASE_URL` to production domain
- [ ] Add Environment Protection Rule: require approval before deploying to production

### Production Deployment Protection:
- [ ] GitHub Environment > Deployment Branches > Select `main` only
- [ ] GitHub Environment > Deployment Branches > Require code reviews
- [ ] Trigger production via workflow_dispatch (Actions tab > Deploy > Run workflow > environment: production). To enable git-tag triggers instead, add a `push: tags: ['v*']` trigger to deploy.yml and map it to the production environment.

---

## Phase 5: Monitoring & Operations

### CloudWatch Monitoring
- [ ] Set up CloudWatch Alarms:
  - [ ] ECS task failures
  - [ ] RDS CPU > 80%
  - [ ] Redis evictions
  - [ ] ALB target health
- [ ] Create CloudWatch Dashboard with:
  - [ ] ECS task count
  - [ ] RDS database metrics
  - [ ] ALB request count and latency
  - [ ] Frontend (CloudFront) requests

### Logging
- [ ] Review `.github/workflows/deploy.yml` logs regularly
- [ ] Set retention: CloudWatch logs 7 days (staging), 30 days (production)
- [ ] Consider centralized logging (Datadog, New Relic, Grafana) for production

### Health Checks
- [ ] ALB health check: `/api/v1/health` on port 3000
- [ ] Frontend health: `https://domain/`
- [ ] Database connectivity: ECS task logs should show no connection errors
- [ ] Redis connectivity: same

### Rollback Procedure
- [ ] **ECS rollback** (30 seconds):
  ```bash
  # Get previous task definition revision
  aws ecs list-task-definitions --family braingym-backend | jq '.taskDefinitionArns[-2]'
  
  # Update service to use previous revision
  aws ecs update-service \
    --cluster braingym-production \
    --service braingym-backend \
    --task-definition braingym-backend:PREVIOUS_REVISION
  
  # Wait for stability
  aws ecs wait services-stable --cluster braingym-production --services braingym-backend
  ```
- [ ] **Frontend rollback** (5 minutes):
  ```bash
  # Revert S3 to previous version or re-sync old dist/
  aws s3 sync old-dist/ s3://braingym-production-frontend --delete
  
  # Invalidate CloudFront
  aws cloudfront create-invalidation --distribution-id DIST_ID --paths "/*"
  ```
- [ ] **Database rollback**: manual RDS snapshot restore (requires planning)

---

## Maintenance Tasks (Recurring)

- [ ] Weekly:
  - [ ] Review ECS task logs for errors
  - [ ] Check RDS and Redis metrics for anomalies
  - [ ] Verify smoke tests passing
- [ ] Monthly:
  - [ ] Test rollback procedure
  - [ ] Review Terraform state for drift
  - [ ] Audit IAM role permissions
- [ ] Quarterly:
  - [ ] Upgrade RDS/Redis minor versions
  - [ ] Update Node.js / NestJS / React versions
  - [ ] Review and optimize ECS resources (CPU/memory)

---

## Troubleshooting Quick Reference

| Problem | Solution |
|---------|----------|
| Deploy fails at "Build & Push" | ECR permissions missing; check IAM role |
| Migration task times out | RDS unreachable; check security groups |
| Service fails health check | ALB target group path wrong; should be `/api/v1/health` |
| Frontend shows 403 | S3 not accessible; check CloudFront OAC |
| API 502 errors | ECS task crashed; check CloudWatch logs |
| Database errors | Connection string wrong; verify DATABASE_URL in Secrets Manager |

---

## Key Files

- [DEPLOYMENT_AWS.md](./DEPLOYMENT_AWS.md) — Full setup guide with IAM policies
- [.github/workflows/deploy.yml](./.github/workflows/deploy.yml) — Deployment workflow
- [backend/docker-entrypoint.sh](./backend/docker-entrypoint.sh) — Refactored for safe deploys
- [infra/](./infra/) — Terraform modules for AWS resources
- [DEPLOYMENT_IMPLEMENTATION_CHECKLIST.md](./DEPLOYMENT_IMPLEMENTATION_CHECKLIST.md) — This file

---

## Support

- AWS Docs: https://docs.aws.amazon.com/
- Terraform AWS Provider: https://registry.terraform.io/providers/hashicorp/aws/latest/docs
- GitHub Actions: https://docs.github.com/en/actions
- ECS Fargate: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ECS_on_Fargate.html

