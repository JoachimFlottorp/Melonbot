import { promises as fs } from 'node:fs';
import { Pool } from 'pg';
import * as path from 'node:path';
import { Kysely, PostgresDialect, Migrator, FileMigrationProvider, sql } from 'kysely';
import { getDirname } from './../../tools/tools.js';
import ChannelTable from './Tables/ChannelTable.js';
import CommandTable from './Tables/CommandTable.js';
import ErrorLogsTable from './Tables/ErrorLogsTable.js';
import StatsTable from './Tables/StatsTable.js';
import SuggestionsTable from './Tables/SuggestionsTable.js';
import TimerTable from './Tables/TimerTable.js';
import UserTable from './Tables/UserTable.js';
import CommandsExecutionTable from './Tables/CommandsExecutionTable.js';
import WebReqeustLogTable from './Tables/WebRequestLogTable.js';

export type KyselyDB = Kysely<Database>;

export interface Database {
	channels: ChannelTable;
	commands: CommandTable;
	// TODO: Move into the logs database
	error_logs: ErrorLogsTable;
	stats: StatsTable;
	suggestions: SuggestionsTable;
	timers: TimerTable;
	users: UserTable;
	'logs.commands_execution': CommandsExecutionTable;
	'logs.web_request': WebReqeustLogTable;
}

export default function (): KyselyDB {
	const db = new Kysely<Database>({
		dialect: new PostgresDialect({
			pool: new Pool({
				connectionString: Bot.Config.SQL.Address,
			}),
		}),
	});

	return db;
}

export async function DoMigration(db: KyselyDB): Promise<void> {
	const migrator = new Migrator({
		db,
		provider: new FileMigrationProvider({
			fs,
			path,
			migrationFolder: getDirname(import.meta.url) + '/Migrations',
		}),
	});

	const { error, results } = await migrator.migrateToLatest();

	if (error) {
		Bot.Log.Error('Failed to run migration: %o', error);

		process.exit(1);
	}

	if (results === undefined || results?.length === 0) {
		Bot.Log.Info('No migrations to run');

		return;
	}

	for (const result of results) {
		switch (result.status) {
			case 'Success': {
				Bot.Log.Info('Migration %s was successful', result.migrationName);
				break;
			}
			case 'Error': {
				// Documentation specify result.error will contain the error message, if the result.status is of Error. So unsure...
				const { error } = result as unknown as { error: string };

				Bot.Log.Error(
					'Migration %s failed with error: %o',
					result.migrationName,
					error ?? 'Unknown error',
				);
				break;
			}
			case 'NotExecuted': {
				Bot.Log.Warn('Migration %s was not executed', result.migrationName);
				break;
			}
		}
	}

	Bot.Log.Info('Migration complete');
}

// https://github.com/koskimas/kysely/issues/112#issuecomment-1177546703
export function GenerateSqlEnum(...args: string[]) {
	return sql`enum(${sql.join(args.map(sql.literal))})`;
}
