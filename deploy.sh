#!/bin/bash
set -e

echo "Extracting files..."
mkdir -p /opt/wa-dashboard
tar -xzf /root/wa-dashboard.tar.gz -C /opt/wa-dashboard
cd /opt/wa-dashboard

echo "Building and starting Docker containers..."
docker compose up -d --build

echo "Installing Nginx and Certbot..."
apt-get update
apt-get install -y nginx certbot python3-certbot-nginx

echo "Configuring Nginx..."
cat > /etc/nginx/sites-available/wa-dashboard << 'NGINX'
server {
    listen 80;
    server_name ai.webbea.qa;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/wa-dashboard /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

echo "Testing Nginx config and restarting..."
nginx -t
systemctl restart nginx

echo "Attempting to obtain SSL certificate..."
# We will use --register-unsafely-without-email if we don't have an email, but let's just provide a dummy one
certbot --nginx -d ai.webbea.qa --non-interactive --agree-tos -m admin@webbea.qa || true

echo "Deployment finished!"
