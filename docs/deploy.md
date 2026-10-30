# Deploying to Nebius

The app is one container: it serves the built client and the API (`server.ts`) on one port. Data lives in Supabase and
models run on Nebius Token Factory, so the container itself is stateless.

> Status: the image definition and the runtime dependency list were checked (the server boots from the six runtime
> packages alone and answers `/api/health`), but Docker is not installed on the machine this was written on, so
> **`docker build` has not been run yet**. Run it once before relying on this guide.

## 1. Prerequisites

- A Nebius project, the [Nebius CLI](https://docs.nebius.com/cli) with a profile, and Docker.
- The Supabase schema applied (`npm run db:apply`) and the keys from `.env.example`.
- Supabase Auth: set **Site URL** and **Redirect URLs** to the endpoint URL once you have it (magic links and Google sign-in both need this).
- Google Maps: the browser key must allow your endpoint URL as an HTTP referrer. The server key (Places, Geocoding, Directions) is a separate key and stays secret.

## 2. Build and push the image

```bash
docker build -t nemo \
  --build-arg VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=YOUR-PUBLISHABLE-KEY \
  --build-arg GOOGLE_MAPS_PLATFORM_KEY=YOUR-BROWSER-MAPS-KEY .
```

The three build args end up in the browser bundle, so they must be public values. Every secret is passed at run time.

Push to a Nebius Container Registry (create one in the console first):

```bash
nebius registry configure-helper                      # once: lets docker authenticate to cr.<region>.nebius.cloud
nebius registry list                                   # note the registry FQDN
docker tag nemo cr.eu-north1.nebius.cloud/REGISTRY_PATH/nemo:1
docker push cr.eu-north1.nebius.cloud/REGISTRY_PATH/nemo:1
```

Check the host name against `nebius registry list`; it depends on your region.
Source: [Container Registry quickstart](https://docs.nebius.com/container-registry/quickstart).

## 2a. No Docker on your machine: let GitHub build the image

Docker Desktop needs virtualization, which many laptops have switched off. You do not need it. The workflow
`.github/workflows/docker.yml` builds the image on GitHub, starts it to check it answers, and publishes it to
`ghcr.io/aaronthomas-ctrl/finding-with-nemo:latest` on every push to `main`.

One-time setup on GitHub (repository **Settings**):
1. **Secrets and variables, Actions, Variables tab**: add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `GOOGLE_MAPS_PLATFORM_KEY` (the browser-restricted Maps key). These are public values; use **Variables**, not Secrets.
2. Push (or run the workflow by hand from the **Actions** tab). When it is green, open your profile's **Packages**, select `finding-with-nemo`, **Package settings**, and set visibility to **Public** so a Nebius endpoint can pull it without credentials. The image contains no secrets: every secret is passed at run time.
3. Use `--image ghcr.io/aaronthomas-ctrl/finding-with-nemo:latest` in step 4 and skip the registry steps above.

## 3. Secrets

Create one MysteryBox secret per value below and reference each with `--env-secret KEY=SECRET`:

| Key | What |
| --- | --- |
| `NEBIUS_API_KEY` | Token Factory |
| `SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Supabase (the server builds a per-user client from the caller's JWT) |
| `TAVILY_API_KEY` | Tavily |
| `GOOGLE_MAPS_PLATFORM_KEY` | Server-side Maps key (Places, Geocoding, Directions) |
| `PII_ENCRYPTION_KEY` | 32 random bytes, base64: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `ASR_BASE_URL`, `ASR_API_KEY`, `MODEL_ASR` | Optional speech-to-text (NVIDIA NIM). Without them the browser transcript is used |

The model names are plain settings, not secrets: pass them with `--env` (`MODEL_ULTRA`, `MODEL_SUPER`, `MODEL_NANO`, `MODEL_EMBED`, `EMBED_DIMENSIONS`, `NEBIUS_BASE_URL`).

**Never** give the container the Supabase service-role key. The app does not need it, and every request runs as the signed-in user so row level security applies.

## 4. Create the endpoint

```bash
nebius ai endpoint create \
  --name nemo \
  --image cr.eu-north1.nebius.cloud/REGISTRY_PATH/nemo:1 \
  --platform cpu-d3 --preset 4vcpu-16gb \
  --container-port 3000 \
  --auth none \
  --env NODE_ENV=production \
  --env MODEL_ULTRA=nvidia/Nemotron-3-Ultra-550b-a55b \
  --env MODEL_SUPER=nvidia/Nemotron-3.5-Super-VL \
  --env MODEL_NANO=nvidia/Nemotron-3_5-Lightning \
  --env MODEL_EMBED=Qwen/Qwen3-Embedding-8B \
  --env EMBED_DIMENSIONS=1024 \
  --env NEBIUS_BASE_URL=https://api.tokenfactory.nebius.com/v1 \
  --env-secret NEBIUS_API_KEY=nebius-api-key \
  --env-secret SUPABASE_URL=supabase-url \
  --env-secret VITE_SUPABASE_ANON_KEY=supabase-anon-key \
  --env-secret TAVILY_API_KEY=tavily-api-key \
  --env-secret GOOGLE_MAPS_PLATFORM_KEY=google-maps-key \
  --env-secret PII_ENCRYPTION_KEY=pii-encryption-key \
  --dry-run
```

Remove `--dry-run` to create it. `--auth none` is correct here: the app has its own sign-in (Supabase Auth) and every
API route except `/api/health` requires a valid user token. HTTP ports get a managed `https://` URL, which is the hosted URL for Devpost.
If your registry is private, add `--registry-secret` (a MysteryBox secret with `REGISTRY_USERNAME` and `REGISTRY_PASSWORD`).
Flags are from the [endpoint create reference](https://docs.nebius.com/cli/reference/ai/endpoint/create); run `nebius ai endpoint create --help` if a flag has changed.

Health check path: `/api/health`.

## 5. After it is up

1. Put the endpoint URL into Supabase Auth (Site URL and Redirect URLs) and the Maps browser-key referrer list.
2. Create the judge account (Supabase dashboard, Authentication, Add user, auto-confirm), then seed demo data for it:
   `npm run seed -- --email judge@example.com --activate`
3. Run `curl https://YOUR-ENDPOINT/api/health`, then sign in and try the chat.

## 6. Scheduled and background work

| Work | How it runs today | Notes |
| --- | --- | --- |
| Clear Places-sourced coordinates after 30 days | **Database cron** (`pg_cron`, 03:17 daily), already scheduled | Compliance with the Google Maps terms. Geocoding coordinates and `place_id` are kept |
| Retry flags (3 days after outreach with no reply) | Database function, runs whenever Watchers "Run all now" is pressed | |
| Watchers | **Run now** button, per watcher or all | A schedule needs the service-role key in a Job; not built |
| 3D memory layout (UMAP) | On demand from the Memory page | `layoutMemories` is a plain function, ready to wrap as a Job |
| Voice-note processing | When the browser uploads a note | `processVoiceNote` is a plain function, ready to wrap as a Job |

Nebius supports one-off containers with `nebius ai job create`; the documentation reviewed did not show a schedule option,
so a scheduled watcher run would use a GitHub Actions cron that starts a Job. Jobs are the only place the service-role key
may live, and they must always filter by `org_id`.

## 7. Run the same image locally

```bash
docker run --rm -p 3000:3000 --env-file .env nemo
```
