import { MigrationInterface, QueryRunner } from "typeorm";

export class PushReceipts1784252085235 implements MigrationInterface {
    name = 'PushReceipts1784252085235'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "push_receipts" ("ticket_id" character varying(100) NOT NULL, "token" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6e73afd996d7ae53fee6b96502b" PRIMARY KEY ("ticket_id"))`);
        await queryRunner.query(`CREATE INDEX "idx_push_receipts_created_at" ON "push_receipts" ("created_at") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_push_receipts_created_at"`);
        await queryRunner.query(`DROP TABLE "push_receipts"`);
    }

}
