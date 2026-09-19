# The OpenAI Images API backend

Used only when the user set the `art_backend` option to `api`. The default backend is `codex`, which runs
on the ChatGPT plan and costs nothing extra. This one bills per image, so the plugin never selects it on
its own.

Sizes, model names and prices below are a starting point — verify them against the current OpenAI docs
before quoting a price to the user or debugging a rejected request.

## The key

The key comes from `OPENAI_API_KEY` in the environment. Never write it into a file, a manifest, a prompt,
a log line or a commit. If it is missing, stop and ask the user to export it; do not fall back to another
backend by yourself.

## One image

```bash
curl -s https://api.openai.com/v1/images/generations \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-2",
    "prompt": "flat habit icon, a flame, 2px stroke, single accent colour",
    "size": "1024x1024",
    "background": "transparent",
    "n": 1
  }' \
| node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>process.stdout.write(Buffer.from(JSON.parse(s).data[0].b64_json,"base64")))' \
> assets/icons/flame.png
```

The response carries base64 in `data[N].b64_json`; there is no URL to download. `background: transparent`
needs a PNG or WEBP output format.

## The manifest

Write the same manifest the Codex backend writes, so assets stay reproducible whichever backend drew them:

```json
{
  "assets": [
    {
      "file": "flame.png",
      "prompt": "flat habit icon, a flame, 2px stroke, single accent colour",
      "size": "1024x1024",
      "transparent": true,
      "model": "gpt-image-2",
      "backend": "api",
      "date": "2026-09-19"
    }
  ]
}
```

## Batching

One request per image, so a set of six icons is six billed calls. Write the whole brief first, generate the
set in one pass, and show the user the count and the estimated price before starting.
