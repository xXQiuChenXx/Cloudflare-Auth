export interface Env {
	DISCORD_CLIENT_ID: string;
	DISCORD_CLIENT_SECRET: string;
	DISCORD_REDIRECT_URL: string;
	DISCORD_PERMISSIONS: string;
	DISCORD_SCOPE: string;
	DISCORD_LOGIN_URL: string;
	MICROSOFT_CLIENT_ID: string;
	MICROSOFT_CLIENT_SECRET: string;
	MICROSOFT_SCOPE: string;
	MICROSOFT_REDIRECT_URL: string;
}

async function discord_request(request: Request, env: Env) {
	const { searchParams } = new URL(request.url);
	const code = searchParams.get('code');
	if (!code) return Response.redirect('/', 301);

	const response: any = await fetch('https://discord.com/api/v10/oauth2/token', {
		method: 'POST',
		body: new URLSearchParams({
			client_id: env.DISCORD_CLIENT_ID,
			client_secret: env.DISCORD_CLIENT_SECRET,
			grant_type: 'authorization_code',
			code: code,
			redirect_uri: env.DISCORD_REDIRECT_URL,
		}),
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
	}).then((res) => res.json());

	return createHTMLResponse(
		`<p>${Object.keys(response).map((key) => {
			return `${key} : ${response[key]} <br/>`;
		})}</p>`
	);
}

async function msft_request(request: Request, env: Env) {
	const { searchParams } = new URL(request.url);
	let code = searchParams.get('code');
	if (!code) return Response.redirect('/', 301);
	const body = new URLSearchParams({
		client_id: env.MICROSOFT_CLIENT_ID,
		redirect_uri: env.MICROSOFT_REDIRECT_URL,
		client_secret: env.MICROSOFT_CLIENT_SECRET,
		code: code,
		grant_type: 'authorization_code',
	});
	let response: any = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
		method: 'POST',
		body: body,
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
	});

	if (!response?.ok) return Response.redirect('/', 301);
	response = await response.json();

	return createHTMLResponse(
		`
	<div>
		<h2>Client ID: ${env.MICROSOFT_CLIENT_ID}</h2>
		<h2>Redirect URL: ${env.MICROSOFT_REDIRECT_URL}</h2>
		${Object.keys(response).map((key) => {
			return `<h2>${key}: ${response[key]}</h2>`;
		})}
	</div>
	`,
		200
	);
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const { pathname } = new URL(request.url);

		if (pathname.startsWith('/discord')) {
			return await discord_request(request, env);
		} else if (pathname.startsWith('/microsoft')) {
			return await msft_request(request, env);
		} else {
			const dc_params = new URLSearchParams({
				client_id: env.DISCORD_CLIENT_ID,
				permissions: env.DISCORD_PERMISSIONS,
				response_type: 'code',
				redirect_uri: env.DISCORD_REDIRECT_URL,
				scope: env.DISCORD_SCOPE || 'bot', // combine with '+' sign
			});

			const discord_url = env.DISCORD_LOGIN_URL || `https://discord.com/api/oauth2/authorize?${dc_params.toString()}`;

			const msft_params = new URLSearchParams({
				client_id: env.MICROSOFT_CLIENT_ID,
				response_type: 'code',
				redirect_uri: env.MICROSOFT_REDIRECT_URL,
				scope: env.MICROSOFT_SCOPE, // combine with spaces
			});
			const microsoft_url = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${msft_params.toString()}`;

			const envs: string[] = [
				'DISCORD_CLIENT_ID',
				'DISCORD_CLIENT_SECRET',
				'DISCORD_REDIRECT_URL',
				'DISCORD_PERMISSIONS',
				'DISCORD_SCOPE',
				'DISCORD_LOGIN_URL',
				'MICROSOFT_CLIENT_ID',
				'MICROSOFT_CLIENT_SECRET',
				'MICROSOFT_SCOPE',
				'MICROSOFT_REDIRECT_URL',
			];
			let lacks: string[] = [];
			for (const i of envs) {
				//@ts-ignore
				if (!env[i]) lacks.push(i);
			}

			return createHTMLResponse(
				`<a class="w-25 btn btn-lg btn-primary mr-4" href="${discord_url}" role="button">Login With Discord</a>
			<a class="w-25 btn btn-lg btn-primary" href="${microsoft_url}" role="button">Login With Microsoft</a>
			`,
				200,
				lacks.filter((x) => x !== null)
			);
		}
	},
};

function createHTMLResponse(slot: string, status: number = 200, lacks?: string[]): Response {
	return new Response(
		`<!DOCTYPE html>
			<html lang="en">
	  <head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
		<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet"
		  integrity="sha384-1BmE4kWBq78iYhFldvKuhfTAU6auU8tT94WrHftjDbrCEXSU1oBoqyl2QvZ6jIW3" crossorigin="anonymous">
		<title>Cloudflare Worker Authentication</title>
		<style>
		  html,
		  body {
			height: 100%
		  }
		  body {
			display: flex;
			align-items: center;
			background-color: #f5f5f5;
		  }
		</style>
	  </head>
	  <body>
		<div class="container w-70">
		  <div class="text-center">
			<h2 class="mb-4">Auth Login Worker</h2>
			${slot}
		  </div>
		  <br />
		  <br/>
		  <div class="text-center">
		  	${lacks?.length ? `<h5>Debug Status: ${lacks.join(", ")}</h5>` : ""}
		  </div>
		</div>
		<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"
		  integrity="sha384-ka7Sk0Gln4gmtz2MlQnikT1wXgYsOg+OMhuP+IlRH9sENBO0LRn5q+8nbTov4+1p"
		  crossorigin="anonymous"></script>
	  </html>`,
		{
			status: status,
			headers: {
				'Content-Type': 'text/html',
			},
		}
	);
}
