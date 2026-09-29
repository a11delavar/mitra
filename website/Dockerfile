# syntax=docker/dockerfile:1
# Serves the built site. Build it first (`npm run build`); CI does, see .github/workflows/website.yml.
FROM caddy:2-alpine
COPY <<'CADDYFILE' /etc/caddy/Caddyfile
{
	admin off
}

:8080 {
	root * /srv
	encode
	file_server

	# Astro hashes these, so a changed file always arrives under a new name.
	@hashed path /_astro/*
	header @hashed Cache-Control "public, max-age=31536000, immutable"
	header ?Cache-Control no-cache

	handle_errors 404 {
		root * /srv
		rewrite * /404.html
		file_server
	}
}
CADDYFILE
COPY dist /srv
EXPOSE 8080
