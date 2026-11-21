FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg python3 python3-pip libgomp1 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

RUN pip3 install --break-system-packages --no-cache-dir \
      faster-whisper opencv-python-headless numpy Pillow yt-dlp

COPY . .

RUN cp prisma/vercel/schema.prisma prisma/schema.prisma \
    && npx prisma generate \
    && npm run build

ENV NODE_ENV=production \
    PORT=3000 \
    VIDEO_PYTHON=/usr/bin/python3 \
    FFMPEG_BIN=ffmpeg \
    FFPROBE_BIN=ffprobe \
    MAX_CONCURRENT_JOBS=1

EXPOSE 3000

CMD ["sh", "-c", "if [ \"$CLIPFORGE_ROLE\" = \"worker\" ]; then exec npm run worker; else npx prisma db push && exec npm start; fi"]
