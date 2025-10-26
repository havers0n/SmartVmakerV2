import { bigint, boolean, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const job = pgTable('job', {
    jobid: bigint('jobid', { mode: 'number' }).notNull().default(sql`nextval('cron.jobid_seq')`),
    schedule: text('schedule').notNull(),
    command: text('command').notNull(),
    nodename: text('nodename').notNull().default('localhost'),
    nodeport: integer('nodeport').notNull(),
    database: text('database').notNull(),
    username: text('username').notNull(),
    active: boolean('active').notNull(),
    jobname: text('jobname'),
});


export type Job = typeof job.$inferSelect;

export type NewJob = typeof job.$inferInsert;


export const jobRunDetails = pgTable('job_run_details', {
    jobid: bigint('jobid', { mode: 'number' }),
    runid: bigint('runid', { mode: 'number' }).notNull().default(sql`nextval('cron.runid_seq')`).primaryKey(),
    job_pid: integer('job_pid'),
    database: text('database'),
    username: text('username'),
    command: text('command'),
    status: text('status'),
    return_message: text('return_message'),
    start_time: timestamp('start_time', { withTimezone: true }),
    end_time: timestamp('end_time', { withTimezone: true }),
});


export type JobRunDetails = typeof jobRunDetails.$inferSelect;

export type NewJobRunDetails = typeof jobRunDetails.$inferInsert;
