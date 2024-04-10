/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { RandomWordOptions, generateSlug } from "random-word-slugs";

const options: RandomWordOptions<3> = {
	format: "kebab",
	categories: {
		noun: ["technology", "time", "transportation"],
		adjective: ["time", "quantity"],
	},
	partsOfSpeech: ["noun", "adjective", "noun"],
};

type Message = {
	url: string;
};

export interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	mtc_tokens: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	// MY_BUCKET: R2Bucket;
	//
	// Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
	// MY_SERVICE: Fetcher;
	//
	// Example binding to a Queue. Learn more at https://developers.cloudflare.com/queues/javascript-apis/
	QUEUE: Queue<Message>;
}


interface EmailMessage<Body = unknown> { // Not in the @worker/types package yet, so we define it here
	readonly from: string;
	readonly to: string;
	readonly headers: Headers;
	readonly raw: ReadableStream;
	readonly rawSize: number;

	// @ts-ignore
	constructor(from: String, to: String, raw: ReadableStream | String);

	setReject(reason: String): void;
	forward(rcptTo: string, headers?: Headers): Promise<void>;
	reply(message: EmailMessage): Promise<void>;
}

export default {
	// @ts-ignore
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {

		const url = new URL(request.url);


		switch (url.pathname) {
			case "/stat":
				// get the KV list, and return it as a JSON object
				const keys = await env.mtc_tokens.list();

				if (keys.keys.length == 0) {
					return new Response("No tokens found", { status: 404 });
				}

				// email,token

				// the token kv is [email, token]
				// get all the values
				const values = await Promise.all(keys.keys.map(async (key) => {
					return await env.mtc_tokens.get(key.name);
				}));

				// zip the keys and values together
				const data = keys.keys.map((key, i) => {
					return {
						email: key.name,
						token: values[i]
					}
				});

				return new Response(JSON.stringify(data), {
					headers: {
						"content-type": "text/json"
					}
				});
			case "/generate_emails":
				// we want to generate a bunch of email addresses ending in `@mtc-gtfsrt.transitrid.ing`, and set them to the KV store.
				// the domain is a wildcard, so we can use any email address we want.

				// get the number of emails to generate
				const count = parseInt(url.searchParams.get("count") || "10");

				// generate the emails
				// we should do what-three-words as thats a good way to generate random email addresses

				const emails = []
				for (let i = 0; i < count; i++) {
					emails.push(`${generateSlug(3, options)}@transitrid.ing`)
				}

				// set the emails to the KV store
				await Promise.all(emails.map(async (email) => {
					await env.mtc_tokens.put(email, "null")
				}));
				return new Response("OK");
			case "/gen":
				// we want to generate a bunch of email addresses ending in `@transitrid.ing`, and set them to the KV store.
				// the domain is a wildcard, so we can use any email address we want.

				// get the number of emails to generate

				// generate the emails
				// we should do what-three-words as thats a good way to generate random email addresses

				let unique = false

				while (!unique) {
					const mail = `${generateSlug(3, options)}@transitrid.ing`
					// check if the email is already in the KV store
					const token = await env.mtc_tokens.get(mail)
					if (token === null) {
						unique = true
						await env.mtc_tokens.put(mail, "null")
						return new Response(mail)
					}
				}
				break
			default:
				return new Response("For more information about this worker, visit https://workers.quacksire.dev/jasmine")
		}
		},


	async email(message: EmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
		// check if the email is from the developer resources email, and if not, forward it to be inspected.
		// We don't want to chuck emails from other people, in case they're important (Rate limits, etc.)

		// Get the subject of the email
		const subject = message.headers.get("Subject")
		console.log(`Got email from ${message.from} with subject: ${subject}`)

		if (!message.headers.get("Subject")?.includes("511 SF Bay:")) {
			await message.forward("jasmine@quacksire.dev")
			return // We're done here
		}
		// now we dance



		//zettabyte-numerous-afternoon@mtc-gtfsrt.transitrid.ing

		// Get the email body
		let body = await new Response(message.raw).text()
		body = body.split("<html>")[1].split("</html>")[0]
		body = body.replace(/=0D=0A|=\r\n/g, '')
		body = body.replaceAll('=3D', '=') // fix the =3D issue

		console.log(body)



		if (subject?.includes("Developer Token Request")) {
			// Get the email body
			console.log(`${message.to} got a email verification request.`)


			// the first markdown link in the email is the verification link.

			// Get the verification link

			// we want to get the link out of the email body
			/**
			 * the email body
			 *```
			 * <head>    <title></title></head><body>    Dear Sam,    <br /><br />    Thank you for your interest in 511 SF Bay Open APIs.    <br /><br />    In order to create a developer account, you must verify that you have a valid email address. Please click the link below to complete the token request.    <br /><br />    <a href=3D\"https://511.org/request-verify?verification-token=3D83a32338-20e6-4182-9b36-3be70075e8ea\" target=3D\"_blank\">https://511.org/request-verify?verification-token=3D83a32338-20e6-4182-9b36-3be70075e8ea</a>    <br /><br />    You may also copy and paste the link text into a web browser. If you have any questions, please feel free to contact us at <a href=3D\"mailto:developerresources@511.org\" target=3D\"_top\">developerresources@511.org</a>.    <br /><br />    Thank you,    <br /><br />    511 SF Bay    <br />    <a href=3D\"https://www.511.org\" target=3D\"_blank\">https://www.511.org</a></body>
			 *```
			 *
			 * Get the first link in the email body
			 *
			 * */

			let vtoken = body.match(/=([A-Za-z0-9]+(-[A-Za-z0-9]+)+)/i)?.[1]
			console.log(`Got token: ${vtoken}`)
			// remove the first 3D from the token (should be the first two characters), but if `3D` is not the first two characters, we'll ignore it.
			if (vtoken?.startsWith("3D")) {
				vtoken = vtoken.slice(2)
			}

			let url = `https://511.org/request-verify?verification-token=${vtoken}`
			console.log(`Got link: ${url}`)
			if (vtoken) {
				await env.QUEUE.send({ url })
			}
			return // We're done here
		}

		// after we verify the link, they send an email with a token.
		if (subject?.includes("Welcome to Open APIs")) {

			console.log(body)

			const regex = /Here is your token:\s*<br\s*\/?>\s*([\w-]+)/i;
			const match = body.match(regex);

			if (match) {
				const token = match[1];
				console.log(`${message.to} got a token.`)
				// we want to store the token and the email associated with it
				await env.mtc_tokens.put(message.to, token)
				console.log(`Stored token for ${message.to}: ${token}`)
			} else {
				console.log("Token not found in the email body.");
			}


			return // We're done here
		}

		// If we haven't returned by now, the email is something else, so we'll just forward it to be inspected.
		await message.forward("jasmine@quacksire.dev")
	},
};
