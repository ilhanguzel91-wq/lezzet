#!/usr/bin/env bash
# Lezzet Rotası — Google Cloud kurulumu ve sunucu yayını.
#
# Kullanım (Cloud Shell'de veya gcloud kurulu bilgisayarda, depo kök dizininden):
#   PROJECT_ID=lezzet-rotasi-123 ADMIN_EMAIL=siz@ornek.com bash deploy/gcp-kurulum.sh
#
# İsteğe bağlı:
#   REGION=europe-west1          (varsayılan)
#   MAPS_SERVER_KEY=AIza...      (sunucu tarafı Google Directions anahtarı)
#
# Tekrar çalıştırılabilir: var olan kaynaklar atlanır, yalnızca yeni sürüm yayınlanır.
set -euo pipefail

: "${PROJECT_ID:?PROJECT_ID verin (Google Cloud proje kimliği)}"
: "${ADMIN_EMAIL:?ADMIN_EMAIL verin (ilk yönetici hesabının e-postası)}"
REGION="${REGION:-europe-west1}"
INSTANCE="lezzet-db"
DB_NAME="lezzet"
DB_USER="lezzet"
SERVICE="lezzet-api"

secret_exists() { gcloud secrets describe "$1" >/dev/null 2>&1; }

echo "==> Proje: $PROJECT_ID, bölge: $REGION"
gcloud config set project "$PROJECT_ID" >/dev/null
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
RUN_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

echo "==> Gerekli Google API'leri açılıyor"
gcloud services enable run.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com \
  cloudbuild.googleapis.com artifactregistry.googleapis.com

echo "==> Cloud SQL (PostgreSQL) örneği"
if ! gcloud sql instances describe "$INSTANCE" >/dev/null 2>&1; then
  # En küçük paylaşımlı makine; kullanıcı arttıkça --tier büyütülebilir.
  gcloud sql instances create "$INSTANCE" --database-version=POSTGRES_17 --edition=enterprise \
    --tier=db-f1-micro --region="$REGION" --storage-auto-increase --backup-start-time=03:00
fi
gcloud sql databases describe "$DB_NAME" --instance="$INSTANCE" >/dev/null 2>&1 \
  || gcloud sql databases create "$DB_NAME" --instance="$INSTANCE"
CONN=$(gcloud sql instances describe "$INSTANCE" --format='value(connectionName)')

echo "==> Gizli bilgiler (Secret Manager)"
if ! secret_exists lezzet-database-url; then
  DB_PASS=$(openssl rand -hex 24)
  gcloud sql users create "$DB_USER" --instance="$INSTANCE" --password="$DB_PASS"
  printf 'postgresql://%s:%s@/%s?host=/cloudsql/%s' "$DB_USER" "$DB_PASS" "$DB_NAME" "$CONN" \
    | gcloud secrets create lezzet-database-url --data-file=-
fi
secret_exists lezzet-auth-secret || openssl rand -hex 32 | gcloud secrets create lezzet-auth-secret --data-file=-
if ! secret_exists lezzet-admin-password; then
  ADMIN_PASSWORD=$(openssl rand -base64 18 | tr -d '/+=')
  printf '%s' "$ADMIN_PASSWORD" | gcloud secrets create lezzet-admin-password --data-file=-
  echo "    İlk yönetici şifresi: $ADMIN_PASSWORD  (Secret Manager'da 'lezzet-admin-password' olarak da saklı)"
fi
SECRETS="DATABASE_URL=lezzet-database-url:latest,AUTH_SECRET=lezzet-auth-secret:latest,ADMIN_PASSWORD=lezzet-admin-password:latest"
if [[ -n "${MAPS_SERVER_KEY:-}" ]]; then
  secret_exists lezzet-maps-key || printf '%s' "$MAPS_SERVER_KEY" | gcloud secrets create lezzet-maps-key --data-file=-
fi
if secret_exists lezzet-maps-key; then SECRETS="$SECRETS,GOOGLE_MAPS_API_KEY=lezzet-maps-key:latest"; fi

echo "==> Cloud Run hizmet hesabına yetkiler"
for ROLE in roles/secretmanager.secretAccessor roles/cloudsql.client; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$RUN_SA" --role="$ROLE" --condition=None >/dev/null
done

echo "==> Sunucu derlenip Cloud Run'a yayınlanıyor (birkaç dakika sürer)"
gcloud run deploy "$SERVICE" --source server --region "$REGION" --allow-unauthenticated \
  --add-cloudsql-instances "$CONN" \
  --set-secrets "$SECRETS" \
  --set-env-vars "NODE_ENV=production,SEED_DEMO=0,ADMIN_EMAIL=$ADMIN_EMAIL" \
  --memory 512Mi --min-instances 0 --max-instances 3

URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')
echo
echo "Tamamlandı."
echo "  API:            $URL/api"
echo "  Yönetim paneli: $URL/admin   (giriş: $ADMIN_EMAIL)"
echo "  Mobil uygulamada EXPO_PUBLIC_API_URL=$URL/api kullanın (mobile/eas.json)."
