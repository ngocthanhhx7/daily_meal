# Daily Meal API on EC2

This deploys the Express API on Amazon Linux 2023 with PM2 and Nginx.

## EC2 Console

Use the same region as S3, currently `us-east-1`.

- AMI: Amazon Linux 2023
- Instance type: `t4g.small` is fine for this app
- Key pair: keep the `.pem` file safe
- Security group inbound:
  - SSH `22` from your IP only
  - HTTP `80` from `0.0.0.0/0`
  - HTTPS `443` from `0.0.0.0/0` when you add SSL
  - TCP `4000` only for temporary debugging, otherwise keep it closed

Prefer attaching an IAM role to the EC2 instance instead of storing AWS keys in `.env`.
The role needs S3 permissions for the bucket used by uploads:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:PutObjectAcl"],
      "Resource": "arn:aws:s3:::dailymeal123/*"
    }
  ]
}
```

If `S3_OBJECT_ACL` is empty and your bucket policy handles public reads, `s3:PutObjectAcl` is not required.

## Server Setup

SSH into the instance:

```bash
ssh -i dailyApp.pem ec2-user@EC2_PUBLIC_IP
```

Install system packages:

```bash
sudo dnf update -y
sudo dnf install -y git nginx
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
sudo npm install -g pm2
```

Clone and build:

```bash
git clone YOUR_REPO_URL daily_meal
cd daily_meal
npm ci
npm run build
cp server/.env.example server/.env
nano server/.env
```

Recommended production values:

```env
NODE_ENV=production
PORT=4000
CLIENT_ORIGIN=*
STORAGE_DRIVER=s3
AWS_REGION=us-east-1
AWS_S3_BUCKET=dailymeal123
S3_OBJECT_ACL=public-read
```

If you attached an EC2 IAM role, leave `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` empty.

Start the API:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u ec2-user --hp /home/ec2-user
```

Run the command printed by `pm2 startup`, then:

```bash
pm2 status
curl http://127.0.0.1:4000/health
```

## Nginx for PWA & API (with Cloudflare / SSL)

Create or replace `/etc/nginx/conf.d/daily-meal-api.conf`:

```nginx
server {
    listen 80;
    server_name ngocthanhhx7.site www.ngocthanhhx7.site;

    root /var/www/daily-meal;
    index index.html;
    client_max_body_size 10m;

    # Dynamic cache control for SPA index.html
    location = /index.html {
        add_header Cache-Control "no-store";
        try_files $uri =404;
    }

    # Dynamic cache control for PWA manifest
    location = /manifest.json {
        add_header Cache-Control "no-cache";
        try_files $uri =404;
    }

    # Dynamic cache control for service worker
    location = /sw.js {
        add_header Cache-Control "no-cache";
        try_files $uri =404;
    }

    # Proxy API requests to node server
    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Proxy Image Uploads to node server uploads folder
    location /uploads/ {
        proxy_pass http://127.0.0.1:4000/uploads/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Fallback to SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static assets cache
    location ~* \.(?:js|css|png|jpg|jpeg|gif|svg|woff2?|ico)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
        try_files $uri =404;
    }
}
```

Enable it and restart Nginx:

```bash
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
```

---

## Web PWA Build & Deployment

Build the Expo web app on the EC2 instance and copy it to the web root:

```bash
# 1. Go to the project root
cd ~/daily_meal

# 2. Pull new changes
git pull

# 3. Clean install dependencies
npm ci

# 4. Export static files for web
npm --workspace client run build:web

# 5. Create deployment directory and copy assets
sudo mkdir -p /var/www/daily-meal
sudo rsync -a --delete client/dist/ /var/www/daily-meal/
sudo chown -R nginx:nginx /var/www/daily-meal
```

Verify PWA serving:

```bash
# Verify headers and serving locally
curl -I http://127.0.0.1/
curl -I http://127.0.0.1/manifest.json
curl http://127.0.0.1/api/auth/me
```

---

## Cloudflare Setup

To connect your domain `ngocthanhhx7.site` with Cloudflare:

1. **DNS Setup**: Add an `A` record pointing to `54.197.170.50` with proxy status enabled (orange cloud).
2. **SSL/TLS Mode**: 
   - Set to **Flexible** if Nginx only listens on Port 80 (HTTP). Cloudflare will handle client-side HTTPS and proxy requests to your EC2 instance over HTTP.
   - Set to **Full** or **Full (Strict)** if you configure Certbot SSL keys directly on your EC2 Nginx.

---

## Updates

To pull new code and deploy updates:

```bash
cd ~/daily_meal
git pull
npm ci

# Update server
npm run build
pm2 restart daily-meal-api
pm2 logs daily-meal-api

# Update client/PWA
npm --workspace client run build:web
sudo rsync -a --delete client/dist/ /var/www/daily-meal/
sudo chown -R nginx:nginx /var/www/daily-meal
```

