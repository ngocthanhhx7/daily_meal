# Build Daily Meal APK

This builds an Android APK that points to the EC2 API at `http://54.197.170.50`.

## 1. Start The API On EC2

On the EC2 terminal:

```bash
sudo dnf update -y
sudo dnf install -y git nginx
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
sudo npm install -g pm2
```

Clone the repo:

```bash
git clone https://github.com/ngocthanhhx7/daily_meal.git daily_meal
cd daily_meal
npm ci
npm run build
cp server/.env.example server/.env
nano server/.env
```

Set production env values in `server/.env`:

```env
NODE_ENV=production
PORT=4000
CLIENT_ORIGIN=*
STORAGE_DRIVER=s3
AWS_REGION=us-east-1
AWS_S3_BUCKET=dailymeal123
S3_OBJECT_ACL=public-read
```

If EC2 has an IAM role with S3 access, leave AWS keys empty. Otherwise set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.

Start API with PM2:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u ec2-user --hp /home/ec2-user
```

Run the command printed by `pm2 startup`, then test:

```bash
curl http://127.0.0.1:4000/health
```

## 2. Expose API Through Nginx

Create Nginx config:

```bash
sudo tee /etc/nginx/conf.d/daily-meal-api.conf >/dev/null <<'EOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
```

Start Nginx:

```bash
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
curl http://54.197.170.50/health
```

Your EC2 security group must allow inbound HTTP `80`.

## 3. Build APK With EAS

On your local machine:

```bash
cd D:\Daily_Meal_App\daily_meal
npm install
npm --workspace client run typecheck
cd client
npx eas-cli login
npx eas-cli build:configure
npm run build:apk
```

The APK profile is `preview` in `client/eas.json`, and currently uses:

```env
EXPO_PUBLIC_API_URL=http://54.197.170.50
```

When EAS finishes, it will print a download URL for the APK.

## 4. After Adding HTTPS

Replace every `http://54.197.170.50` in:

- `client/.env`
- `client/eas.json`

with your HTTPS domain, for example:

```env
EXPO_PUBLIC_API_URL=https://api.your-domain.com
```

Then remove `usesCleartextTraffic` from `client/app.json` or set it to `false`.
