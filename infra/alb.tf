# Application Load Balancer
resource "aws_lb" "main" {
  name               = "${var.app_name}-${var.environment}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = var.environment == "production"

  tags = merge(var.common_tags, {
    Name = "${var.app_name}-${var.environment}-alb"
  })
}

# Target Group — points to ECS tasks on port 3000
resource "aws_lb_target_group" "backend" {
  name        = "${var.app_name}-${var.environment}"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip" # required for Fargate

  health_check {
    enabled             = true
    path                = "/api/v1/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  # Allow in-flight requests to drain before deregistering
  deregistration_delay = 30

  tags = merge(var.common_tags, {
    Name = "${var.app_name}-${var.environment}-tg"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# HTTP Listener — forwards all traffic to target group
# Add an HTTPS listener here once you attach an ACM certificate
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}

output "alb_dns_name" {
  value       = aws_lb.main.dns_name
  description = "ALB DNS name — used as CloudFront API origin"
}

output "alb_arn" {
  value = aws_lb.main.arn
}

output "alb_target_group_arn" {
  value       = aws_lb_target_group.backend.arn
  description = "Target group ARN — used in ECS service load balancer config"
}
