using System;
using System.IO;
using System.Text;
using System.Collections.Generic;

public class EmojiFixer {
    public static void Main() {
        string[] files = { "index.html", "app.js", "features.js", "styles.css", "career-ops.js" };
        var map = new Dictionary<string, string> {
            { "ğŸ“", "??" }, { "ğŸ™", "??" }, { "ğŸ??", "??" }, { "ğŸ“??", "??" },
            { "ğŸ§", "??" }, { "ğŸš€", "??" }, { "ğŸ“??", "??" }, { "ğŸ??", "??" },
            { "ğŸ??", "??" }, { "ğŸ??", "??" }, { "ğŸ”", "??" }, { "ğŸ??", "??" },
            { "ğŸ?", "?" }, { "ğŸ??", "??" }, { "ğŸ??", "??" }, { "ğŸ?", "?" },
            { "ğŸ?", "?" }, { "ğŸ??", "??" }, { "ğŸ??", "??" }, { "ğŸ?", "?" },
            { "ğŸ?", "?" }, { "ğŸ??", "??" }, { "ğŸ??", "??" }, { "ğŸ??", "??" },
            { "ğŸ???", "???" }, { "ğŸ??", "??" }, { "ğŸ??", "??" }
        };

        foreach (var file in files) {
            if (!File.Exists(file)) continue;
            string content = File.ReadAllText(file, Encoding.UTF8);
            foreach (var kvp in map) {
                content = content.Replace(kvp.Key, kvp.Value);
            }
            // Fix layout specifically in styles.css
            if (file == "styles.css") {
                content = content.Replace(".main-content{margin-left:var(--sidebar-w);", ".main-content{margin-left:240px !important;");
                content = content.Replace(".top-bar{", ".top-bar{left:240px; ");
            }
            File.WriteAllText(file, content, new UTF8Encoding(true)); // UTF-8 with BOM
        }
    }
}
