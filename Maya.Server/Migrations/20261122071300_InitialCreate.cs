using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Maya.Server.Migrations;

/// <inheritdoc />
public partial class _20261122071300_InitialCreate : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "conversations",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                title = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                is_archived = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_conversations", x => x.id);
            });

        migrationBuilder.CreateTable(
            name: "device_statuses",
            columns: table => new
            {
                device_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                device_type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                is_online = table.Column<bool>(type: "boolean", nullable: false),
                cpu_usage_percent = table.Column<double>(type: "double precision", nullable: true),
                ram_usage_percent = table.Column<double>(type: "double precision", nullable: true),
                battery_percent = table.Column<int>(type: "integer", nullable: true),
                fcm_token = table.Column<string>(type: "text", nullable: true),
                last_seen_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_device_statuses", x => x.device_id);
            });

        migrationBuilder.CreateTable(
            name: "memory_entries",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                key = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                value = table.Column<string>(type: "text", nullable: false),
                category = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                importance = table.Column<int>(type: "integer", nullable: false, defaultValue: 5),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_memory_entries", x => x.id);
            });

        migrationBuilder.CreateTable(
            name: "user_auth_configs",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                pin_hash = table.Column<string>(type: "text", nullable: false),
                webauthn_credential_id = table.Column<string>(type: "text", nullable: true),
                webauthn_public_key = table.Column<string>(type: "text", nullable: true),
                google_refresh_token_enc = table.Column<string>(type: "text", nullable: true),
                updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_user_auth_configs", x => x.id);
            });

        migrationBuilder.CreateTable(
            name: "vault_entries",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                service_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                username = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                encrypted_secret = table.Column<string>(type: "text", nullable: false),
                iv_nonce = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                auth_tag = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                notes = table.Column<string>(type: "text", nullable: true),
                updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_vault_entries", x => x.id);
            });

        migrationBuilder.CreateTable(
            name: "chat_messages",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                conversation_id = table.Column<Guid>(type: "uuid", nullable: false),
                role = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                content = table.Column<string>(type: "text", nullable: false),
                tool_call_json = table.Column<string>(type: "jsonb", nullable: true),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_chat_messages", x => x.id);
                table.ForeignKey(
                    name: "FK_chat_messages_conversations_conversation_id",
                    column: x => x.conversation_id,
                    principalTable: "conversations",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "command_logs",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                conversation_id = table.Column<Guid>(type: "uuid", nullable: true),
                command_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                payload_json = table.Column<string>(type: "jsonb", nullable: false),
                requires_confirmation = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                result_output = table.Column<string>(type: "text", nullable: true),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_command_logs", x => x.id);
                table.ForeignKey(
                    name: "FK_command_logs_conversations_conversation_id",
                    column: x => x.conversation_id,
                    principalTable: "conversations",
                    principalColumn: "id",
                    onDelete: ReferentialAction.SetNull);
            });

        migrationBuilder.CreateIndex(
            name: "IX_chat_messages_conversation_id_created_at",
            table: "chat_messages",
            columns: new[] { "conversation_id", "created_at" });

        migrationBuilder.CreateIndex(
            name: "IX_command_logs_conversation_id",
            table: "command_logs",
            column: "conversation_id");

        migrationBuilder.CreateIndex(
            name: "IX_memory_entries_key",
            table: "memory_entries",
            column: "key",
            unique: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "chat_messages");

        migrationBuilder.DropTable(
            name: "command_logs");

        migrationBuilder.DropTable(
            name: "device_statuses");

        migrationBuilder.DropTable(
            name: "memory_entries");

        migrationBuilder.DropTable(
            name: "user_auth_configs");

        migrationBuilder.DropTable(
            name: "vault_entries");

        migrationBuilder.DropTable(
            name: "conversations");
    }
}
