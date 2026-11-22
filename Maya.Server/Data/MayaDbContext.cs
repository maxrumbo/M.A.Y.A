using Maya.Server.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Maya.Server.Data;

/// <summary>
/// EF Core DbContext utama M.A.Y.A.
/// Semua tabel menggunakan snake_case sesuai konvensi PostgreSQL.
/// Semua PK menggunakan UUID (Guid), semua timestamp menggunakan timestamptz (DateTimeOffset).
/// </summary>
public class MayaDbContext : DbContext
{
    public MayaDbContext(DbContextOptions<MayaDbContext> options) : base(options) { }

    public DbSet<Conversation> Conversations => Set<Conversation>();
    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();
    public DbSet<MemoryEntry> MemoryEntries => Set<MemoryEntry>();
    public DbSet<VaultEntry> VaultEntries => Set<VaultEntry>();
    public DbSet<CommandLog> CommandLogs => Set<CommandLog>();
    public DbSet<DeviceStatus> DeviceStatuses => Set<DeviceStatus>();
    public DbSet<UserAuthConfig> UserAuthConfigs => Set<UserAuthConfig>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ─── conversations ───────────────────────────────────────────────────
        modelBuilder.Entity<Conversation>(entity =>
        {
            entity.ToTable("conversations");
            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id)
                .HasColumnName("id")
                .HasDefaultValueSql("gen_random_uuid()");

            entity.Property(e => e.Title)
                .HasColumnName("title")
                .HasMaxLength(150)
                .IsRequired();

            entity.Property(e => e.IsArchived)
                .HasColumnName("is_archived")
                .HasDefaultValue(false)
                .IsRequired();

            entity.Property(e => e.CreatedAt)
                .HasColumnName("created_at")
                .IsRequired();

            entity.Property(e => e.UpdatedAt)
                .HasColumnName("updated_at")
                .IsRequired();
        });

        // ─── chat_messages ───────────────────────────────────────────────────
        modelBuilder.Entity<ChatMessage>(entity =>
        {
            entity.ToTable("chat_messages");
            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id)
                .HasColumnName("id");

            entity.Property(e => e.ConversationId)
                .HasColumnName("conversation_id")
                .IsRequired();

            entity.Property(e => e.Role)
                .HasColumnName("role")
                .HasMaxLength(20)
                .IsRequired();

            entity.Property(e => e.Content)
                .HasColumnName("content")
                .IsRequired();

            entity.Property(e => e.ToolCallJson)
                .HasColumnName("tool_call_json")
                .HasColumnType("jsonb");

            entity.Property(e => e.CreatedAt)
                .HasColumnName("created_at")
                .IsRequired();

            // FK → conversations (ON DELETE CASCADE)
            entity.HasOne(e => e.Conversation)
                .WithMany(c => c.ChatMessages)
                .HasForeignKey(e => e.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);

            // Composite index untuk query riwayat pesan per sesi secara efisien
            entity.HasIndex(e => new { e.ConversationId, e.CreatedAt })
                .HasDatabaseName("IX_chat_messages_conversation_id_created_at");
        });

        // ─── memory_entries ──────────────────────────────────────────────────
        modelBuilder.Entity<MemoryEntry>(entity =>
        {
            entity.ToTable("memory_entries");
            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id)
                .HasColumnName("id");

            entity.Property(e => e.Key)
                .HasColumnName("key")
                .HasMaxLength(120)
                .IsRequired();

            entity.Property(e => e.Value)
                .HasColumnName("value")
                .IsRequired();

            entity.Property(e => e.Category)
                .HasColumnName("category")
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(e => e.Importance)
                .HasColumnName("importance")
                .HasDefaultValue(5)
                .IsRequired();

            entity.Property(e => e.CreatedAt)
                .HasColumnName("created_at")
                .IsRequired();

            entity.Property(e => e.UpdatedAt)
                .HasColumnName("updated_at")
                .IsRequired();

            // Unique index — upsert berdasarkan key
            entity.HasIndex(e => e.Key)
                .IsUnique()
                .HasDatabaseName("IX_memory_entries_key");
        });

        // ─── vault_entries ───────────────────────────────────────────────────
        modelBuilder.Entity<VaultEntry>(entity =>
        {
            entity.ToTable("vault_entries");
            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id)
                .HasColumnName("id");

            entity.Property(e => e.ServiceName)
                .HasColumnName("service_name")
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(e => e.Username)
                .HasColumnName("username")
                .HasMaxLength(150)
                .IsRequired();

            entity.Property(e => e.EncryptedSecret)
                .HasColumnName("encrypted_secret")
                .IsRequired();

            entity.Property(e => e.IvNonce)
                .HasColumnName("iv_nonce")
                .HasMaxLength(64)
                .IsRequired();

            entity.Property(e => e.AuthTag)
                .HasColumnName("auth_tag")
                .HasMaxLength(64)
                .IsRequired();

            entity.Property(e => e.Notes)
                .HasColumnName("notes");

            entity.Property(e => e.UpdatedAt)
                .HasColumnName("updated_at")
                .IsRequired();
        });

        // ─── command_logs ────────────────────────────────────────────────────
        modelBuilder.Entity<CommandLog>(entity =>
        {
            entity.ToTable("command_logs");
            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id)
                .HasColumnName("id");

            entity.Property(e => e.ConversationId)
                .HasColumnName("conversation_id");

            entity.Property(e => e.CommandName)
                .HasColumnName("command_name")
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(e => e.PayloadJson)
                .HasColumnName("payload_json")
                .HasColumnType("jsonb")
                .IsRequired();

            entity.Property(e => e.RequiresConfirmation)
                .HasColumnName("requires_confirmation")
                .HasDefaultValue(false)
                .IsRequired();

            entity.Property(e => e.Status)
                .HasColumnName("status")
                .HasMaxLength(30)
                .IsRequired();

            entity.Property(e => e.ResultOutput)
                .HasColumnName("result_output");

            entity.Property(e => e.CreatedAt)
                .HasColumnName("created_at")
                .IsRequired();

            entity.Property(e => e.CompletedAt)
                .HasColumnName("completed_at");

            // FK → conversations (ON DELETE SET NULL)
            entity.HasOne(e => e.Conversation)
                .WithMany(c => c.CommandLogs)
                .HasForeignKey(e => e.ConversationId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // ─── device_statuses ─────────────────────────────────────────────────
        modelBuilder.Entity<DeviceStatus>(entity =>
        {
            entity.ToTable("device_statuses");

            // PK adalah string device_id, bukan UUID
            entity.HasKey(e => e.DeviceId);

            entity.Property(e => e.DeviceId)
                .HasColumnName("device_id")
                .HasMaxLength(100);

            entity.Property(e => e.DeviceType)
                .HasColumnName("device_type")
                .HasMaxLength(30)
                .IsRequired();

            entity.Property(e => e.IsOnline)
                .HasColumnName("is_online")
                .IsRequired();

            entity.Property(e => e.CpuUsagePercent)
                .HasColumnName("cpu_usage_percent");

            entity.Property(e => e.RamUsagePercent)
                .HasColumnName("ram_usage_percent");

            entity.Property(e => e.BatteryPercent)
                .HasColumnName("battery_percent");

            entity.Property(e => e.FcmToken)
                .HasColumnName("fcm_token");

            entity.Property(e => e.LastSeenAt)
                .HasColumnName("last_seen_at")
                .IsRequired();
        });

        // ─── user_auth_configs ───────────────────────────────────────────────
        modelBuilder.Entity<UserAuthConfig>(entity =>
        {
            entity.ToTable("user_auth_configs");
            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id)
                .HasColumnName("id");

            entity.Property(e => e.PinHash)
                .HasColumnName("pin_hash")
                .IsRequired();

            entity.Property(e => e.WebAuthnCredentialId)
                .HasColumnName("webauthn_credential_id");

            entity.Property(e => e.WebAuthnPublicKey)
                .HasColumnName("webauthn_public_key");

            entity.Property(e => e.GoogleRefreshTokenEnc)
                .HasColumnName("google_refresh_token_enc");

            entity.Property(e => e.UpdatedAt)
                .HasColumnName("updated_at")
                .IsRequired();
        });
    }
}
