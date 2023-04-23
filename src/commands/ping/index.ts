import * as tools from './../../tools/tools.js';
import process from 'node:process';
import { ECommandFlags, EPermissionLevel } from './../../Typings/enums.js';
import { registerCommand } from '../../controller/Commands/Handler.js';
import Got from '../../tools/Got.js';

type HealthResponse = {
	goroutine_count: number;
	memory_usage: string;
};

registerCommand({
	Name: 'ping',
	Description: 'Pings the user with some small info.',
	Permission: EPermissionLevel.VIEWER,
	OnlyOffline: false,
	Aliases: [],
	Cooldown: 20,
	Params: [],
	Flags: [ECommandFlags.ResponseIsReply],
	PreHandlers: [],
	Code: async function (ctx) {
		let firehoseHealth: string = '';
		let eventsubHealth: string = '';

		const formatHealth = (health: HealthResponse) => {
			return `${health.goroutine_count} GRC, ${health.memory_usage} Mem`;
		};

		firehoseHealth = await Got['Default']
			.get(`http://127.0.0.1:${Bot.Config.Services.Firehose.HealthPort}/health`)
			.json<HealthResponse>()
			.then(formatHealth)
			.catch(() => 'Down');

		eventsubHealth = await Got['Default']
			.get(`${Bot.Config.Services.EventSub.PublicUrl}/health`)
			.json<HealthResponse>()
			.then(formatHealth)
			.catch(() => 'Down');

		const Result = [
			'🕴️',
			`Uptime ${tools.SecondsFmt(process.uptime())}`,
			`Firehose: ${firehoseHealth}`,
			`EventSub: ${eventsubHealth}`,
			// FIXME: Firehose handle this
			// 'Delay to TMI ' + (await Bot.Redis.SGet('Latency')) + ' ms',
		]
			.filter(Boolean)
			.join(' | ');

		return {
			Success: true,
			Result,
		};
	},
});
