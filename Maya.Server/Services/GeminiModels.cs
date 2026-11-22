using System.Text.Json;
using System.Text.Json.Serialization;

namespace Maya.Server.Services;

// ─── Gemini API Request Models ────────────────────────────────────────────────
// Internal types — HANYA digunakan oleh GeminiService.
// Tidak diekspor ke luar. Tidak ada plaintext secret di sini.

public record GeminiRequest(
    [property: JsonPropertyName("system_instruction")] GeminiContent? SystemInstruction,
    [property: JsonPropertyName("contents")]           List<GeminiContent> Contents,
    [property: JsonPropertyName("tools")]              List<GeminiTool>? Tools,
    [property: JsonPropertyName("generation_config")]  GeminiGenerationConfig? GenerationConfig
);

public class GeminiContent
{
    public GeminiContent() { }

    public GeminiContent(string? Role = null, List<GeminiPart>? Parts = null)
    {
        this.Role = Role;
        this.Parts = Parts ?? new();
    }

    [JsonPropertyName("role")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Role { get; set; }

    [JsonPropertyName("parts")]
    public List<GeminiPart> Parts { get; set; } = new();

    [JsonExtensionData]
    public Dictionary<string, JsonElement>? ExtensionData { get; set; }
}

/// <summary>
/// Satu bagian konten dalam percakapan Gemini.
/// Menyimpan extension data (seperti thought_signature di Gemini 3) agar tidak hilang saat loop tool call.
/// </summary>
public class GeminiPart
{
    [JsonPropertyName("text")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Text { get; set; }

    [JsonPropertyName("functionCall")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public GeminiFunctionCall? FunctionCall { get; set; }

    [JsonPropertyName("functionResponse")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public GeminiFunctionResponse? FunctionResponse { get; set; }

    [JsonExtensionData]
    public Dictionary<string, JsonElement>? ExtensionData { get; set; }
}

public class GeminiFunctionCall
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("args")]
    public JsonElement Args { get; set; }

    [JsonExtensionData]
    public Dictionary<string, JsonElement>? ExtensionData { get; set; }
}

public record GeminiFunctionResponse(
    [property: JsonPropertyName("name")]     string Name,
    [property: JsonPropertyName("response")] object Response // Plain object, bukan secret
);

public record GeminiTool(
    [property: JsonPropertyName("function_declarations")]
    List<GeminiFunctionDeclaration> FunctionDeclarations
);

public record GeminiFunctionDeclaration(
    [property: JsonPropertyName("name")]        string Name,
    [property: JsonPropertyName("description")] string Description,
    [property: JsonPropertyName("parameters")]  object Parameters // JSON Schema object
);

public record GeminiGenerationConfig(
    [property: JsonPropertyName("temperature")]        double Temperature,
    [property: JsonPropertyName("top_p")]              double TopP,
    [property: JsonPropertyName("max_output_tokens")]  int MaxOutputTokens
);

// ─── Gemini API Response Models ───────────────────────────────────────────────

public record GeminiResponse(
    [property: JsonPropertyName("candidates")] List<GeminiCandidate>? Candidates,
    [property: JsonPropertyName("error")]      GeminiErrorDetail? Error
);

public record GeminiCandidate(
    [property: JsonPropertyName("content")]      GeminiContent Content,
    [property: JsonPropertyName("finishReason")] string? FinishReason
);

public record GeminiErrorDetail(
    [property: JsonPropertyName("code")]    int Code,
    [property: JsonPropertyName("message")] string Message,
    [property: JsonPropertyName("status")]  string? Status
);
