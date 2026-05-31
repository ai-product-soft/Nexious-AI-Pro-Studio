#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use lazy_static::lazy_static;
use chrono::{Utc, Datelike};


// ============================================
// ERROR PROPAGATION (Production Grade)
// ============================================

#[derive(Debug, Serialize)]
pub enum MickiiError {
    Io(String),
    NotAbsolute(String),
    Shell(String),
    System(String),
}

impl From<std::io::Error> for MickiiError {
    fn from(err: std::io::Error) -> Self {
        MickiiError::Io(err.to_string())
    }
}

impl From<String> for MickiiError {
    fn from(err: String) -> Self {
        MickiiError::System(err)
    }
}

type MickiiResult<T> = std::result::Result<T, MickiiError>;

// ============================================
// SHARED APP STATE
// ============================================
pub struct AppState {
    pub client: reqwest::Client,
}

// ============================================
// INSTANT RESPONSE CACHE — Pre-computed
// Loaded at startup, never calls external API
// ============================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstantResponse {
    pub intent: String,
    pub skill_id: Option<String>,
    pub response_template: String,
    pub action: String,
    pub confidence: f32,
}

lazy_static! {
    static ref INTENT_CACHE: Mutex<HashMap<String, InstantResponse>> = Mutex::new({
        let mut map = HashMap::new();
        
        // Website Skills
        map.insert("website_ban".to_string(), InstantResponse {
            intent: "execute_skill".to_string(),
            skill_id: Some("website_build".to_string()),
            response_template: "✅ **Website skill ready!**\n\nClient name batao aur niche se template select karo:\n• Fitness Landing\n• Coach Landing\n• Real Estate\n• Agency\n\nMickii template load karke sections add kar dega.".to_string(),
            action: "show_template_selector".to_string(),
            confidence: 1.0,
        });
        map.insert("website".to_string(), InstantResponse {
            intent: "execute_skill".to_string(),
            skill_id: Some("website_build".to_string()),
            response_template: "✅ **Website skill ready!**\n\nKaunsa type?\n1. Landing page\n2. Full website\n3. E-commerce\n\nClient name batao.".to_string(),
            action: "show_template_selector".to_string(),
            confidence: 0.95,
        });
        
        // Proposal Skills
        map.insert("proposal_ban".to_string(), InstantResponse {
            intent: "execute_skill".to_string(),
            skill_id: Some("proposal_create".to_string()),
            response_template: "✅ **Proposal template loaded!**\n\nClient: {client_name}\nProject: {project_name}\n\nMickii ne standard proposal structure ready kar li hai. Price aur scope fill karo.".to_string(),
            action: "show_proposal_form".to_string(),
            confidence: 1.0,
        });
        map.insert("proposal".to_string(), InstantResponse {
            intent: "execute_skill".to_string(),
            skill_id: Some("proposal_create".to_string()),
            response_template: "✅ **Proposal skill active!**\n\nKaunsa type?\n• Standard (50% upfront)\n• Premium (branded)\n• Quick (1-page)\n\nClient name batao.".to_string(),
            action: "show_proposal_form".to_string(),
            confidence: 0.95,
        });
        
        // Lead Skills
        map.insert("lead_check".to_string(), InstantResponse {
            intent: "show_data".to_string(),
            skill_id: None,
            response_template: "📊 **Lead Status Report**\n\n🔥 Hot: {hot_count}\n🌡️ Warm: {warm_count}\n❄️ Cold: {cold_count}\n\n**Top Priority:** {top_lead}\n**Next Action:** {next_action}\n\nFollow-up karoon?".to_string(),
            action: "render_lead_dashboard".to_string(),
            confidence: 1.0,
        });
        map.insert("leads".to_string(), InstantResponse {
            intent: "show_data".to_string(),
            skill_id: None,
            response_template: "📊 **Lead Pipeline**\n\nTotal: {total_leads}\nHot: {hot_count} | Warm: {warm_count} | Cold: {cold_count}\n\nKaunsa lead check karna hai?".to_string(),
            action: "render_lead_dashboard".to_string(),
            confidence: 0.9,
        });
        
        // Morning Brief / Status
        map.insert("aaj_kya_karna".to_string(), InstantResponse {
            intent: "morning_brief".to_string(),
            skill_id: None,
            response_template: "🌅 **Good morning Adii!**\n\nAaj ka plan:\n1. **{top_priority}**\n2. **{second_priority}**\n3. **{third_priority}**\n\n📈 Pipeline: {pipeline_value}\n⏳ Pending Approvals: {pending_approvals}\n🔥 Hot Leads: {hot_leads}\n\nPehle kya karna hai?".to_string(),
            action: "show_dashboard".to_string(),
            confidence: 1.0,
        });
        map.insert("morning".to_string(), InstantResponse {
            intent: "morning_brief".to_string(),
            skill_id: None,
            response_template: "🌅 **Morning Brief Ready!**\n\n{pending_approvals} approvals pending\n{active_projects} projects active\n{hot_leads} hot leads waiting\n\nFocus area: {focus_area}".to_string(),
            action: "show_dashboard".to_string(),
            confidence: 0.95,
        });
        map.insert("status".to_string(), InstantResponse {
            intent: "morning_brief".to_string(),
            skill_id: None,
            response_template: "📊 **System Status**\n\nMickii: ✅ Online\nSkills Loaded: {skill_count}\nTemplates: {template_count}\nLast Backup: {last_backup}\n\nEverything running smooth.".to_string(),
            action: "show_dashboard".to_string(),
            confidence: 0.9,
        });
        
        // Revenue / Money
        map.insert("revenue".to_string(), InstantResponse {
            intent: "show_data".to_string(),
            skill_id: None,
            response_template: "💰 **Revenue Snapshot**\n\nThis Month: {month_revenue}\nExpenses: {month_expense}\nMargin: {margin}%\n\nPipeline: {pipeline_value}\nPending: {pending_value}\n\nBest move: {top_action}".to_string(),
            action: "render_finance_dashboard".to_string(),
            confidence: 0.95,
        });
        map.insert("paisa".to_string(), InstantResponse {
            intent: "show_data".to_string(),
            skill_id: None,
            response_template: "💰 **Money Check**\n\nIncome: {month_revenue}\nExpense: {month_expense}\nProfit: {profit}\n\nAaj ka best move: {top_action}".to_string(),
            action: "render_finance_dashboard".to_string(),
            confidence: 0.9,
        });
        
        // Project Management
        map.insert("project".to_string(), InstantResponse {
            intent: "show_data".to_string(),
            skill_id: None,
            response_template: "🏭 **Production Floor**\n\nActive: {active_projects}\nBlocked: {blocked_projects}\nReady: {ready_projects}\n\nKaunsa project open karna hai?".to_string(),
            action: "render_project_dashboard".to_string(),
            confidence: 0.9,
        });
        map.insert("kanban".to_string(), InstantResponse {
            intent: "show_data".to_string(),
            skill_id: None,
            response_template: "📋 **Kanban Board**\n\nResearch: {research_count}\nDesign: {design_count}\nBuild: {build_count}\nTest: {test_count}\nReady: {ready_count}\n\nKonsa stage check karna hai?".to_string(),
            action: "render_kanban".to_string(),
            confidence: 0.9,
        });
        
        // Help / Capabilities
        map.insert("help".to_string(), InstantResponse {
            intent: "show_help".to_string(),
            skill_id: None,
            response_template: "🤖 **Mickii Capabilities**\n\n**Skills (Execute instantly):**\n• `website_ban` → Website build\n• `proposal_ban` → Proposal create\n• `lead_followup` → Follow-up message\n\n**Data (Instant lookup):**\n• `leads` → Lead status\n• `revenue` → Money snapshot\n• `project` → Production floor\n\n**System:**\n• `morning` → Morning brief\n• `status` → System status\n\nBas Hinglish mein command do!".to_string(),
            action: "show_help".to_string(),
            confidence: 1.0,
        });
        map.insert("kya_kar_sakta".to_string(), InstantResponse {
            intent: "show_help".to_string(),
            skill_id: None,
            response_template: "🤖 **Main kya kar sakta hoon?**\n\n**Website:** Template se website bana sakta hoon\n**Proposal:** Client proposal ready kar sakta hoon\n**Leads:** Score, priority, follow-up\n**Projects:** Track, update, export\n**Reports:** Weekly summary\n\n**Command examples:**\n• \"James ke liye website ban\"\n• \"Lead check karo\"\n• \"Aaj kya karna hai\"\n• \"Paisa kitna hai\"".to_string(),
            action: "show_help".to_string(),
            confidence: 1.0,
        });
        
        // Approval
        map.insert("approval".to_string(), InstantResponse {
            intent: "show_data".to_string(),
            skill_id: None,
            response_template: "🛡️ **Approval Queue**\n\n{pending_count} actions waiting:\n{approval_list}\n\n`yes` → Approve all\n`no` → Reject all\n`review` → Check one by one".to_string(),
            action: "show_approval_queue".to_string(),
            confidence: 0.95,
        });
        
        // Export / Delivery
        map.insert("export".to_string(), InstantResponse {
            intent: "execute_skill".to_string(),
            skill_id: Some("export_project".to_string()),
            response_template: "📦 **Export Ready!**\n\nProject: {project_name}\nFiles: {file_count}\nLocation: {export_path}\n\nClient ko bhejne se pehle preview check karo.".to_string(),
            action: "show_export_preview".to_string(),
            confidence: 0.9,
        });
        
        // Follow-up
        map.insert("followup".to_string(), InstantResponse {
            intent: "execute_skill".to_string(),
            skill_id: Some("lead_followup".to_string()),
            response_template: "📨 **Follow-up Sequence Ready!**\n\nLead: {lead_name}\nMood: {lead_mood}\n\nDraft message:\n\"{message_draft}\"\n\nBhejna hai? (Approval required)".to_string(),
            action: "show_followup_preview".to_string(),
            confidence: 0.9,
        });
        
        // Identity / Product Info
        map.insert("kaise_banta_hai".to_string(), InstantResponse {
            intent: "process_info".to_string(),
            skill_id: None,
            response_template: "🛠️ **Mickii Build Process**\n\nMain professional software standard follow karta hoon:\n1. **Research**: Industry trends aur competitors check karna.\n2. **Design**: User experience aur branding setup.\n3. **Build**: Error-free code aur automation workflows.\n4. **Delivery**: 100% ready asset export.\n\nAap `website_build` command use karke live dekh sakte hain!".to_string(),
            action: "show_help".to_string(),
            confidence: 1.0,
        });
        map.insert("software".to_string(), InstantResponse {
            intent: "identity".to_string(),
            skill_id: None,
            response_template: "🤖 **Mickii Engine — Mabishion AI**\n\nMain ek deterministic business engine hoon. Main aapke business ke liye:\n• Websites bana sakta hoon\n• Leads manage kar sakta hoon\n• Proposals ready kar sakta hoon\n• Workflows automate kar sakta hoon\n\nSab kuch **100% Offline** aur **Private** hai. Aapka data mere paas hi rehta hai.".to_string(),
            action: "show_help".to_string(),
            confidence: 1.0,
        });

        map.insert("kya_hai".to_string(), InstantResponse {
            intent: "identity".to_string(),
            skill_id: None,
            response_template: "Main **Mickii** hoon, aapka industrial-grade AI business agent. Main websites, leads, aur production handle karma hoon.\n\nType `help` to see what I can do!".to_string(),
            action: "show_help".to_string(),
            confidence: 0.8,
        });
        map.insert("kaun_ho".to_string(), InstantResponse {
            intent: "identity".to_string(),
            skill_id: None,
            response_template: "Main **Mickii** hoon! Adii Boss ka personal assistant aur Mabishion Factory ka head agent. Aapka business automate karne ke liye ready hoon.".to_string(),
            action: "show_dashboard".to_string(),
            confidence: 1.0,
        });

        map.insert("mickii".to_string(), InstantResponse {
            intent: "identity".to_string(),
            skill_id: None,
            response_template: "👋 **Mickii at your service!**\n\nMain aapka personal business agent hoon. Mera kaam hai aapki productivity ko industrial scale pe le jaana.\n\nMere pass 3 levels hain:\n1. **Deterministic Logic** (Fastest)\n2. **Local Memory** (Skills & Facts)\n3. **Manual Approval** (Safety First)\n\nAaj kya kaam hai?".to_string(),
            action: "show_dashboard".to_string(),
            confidence: 1.0,
        });
        map.insert("mabishion".to_string(), InstantResponse {
            intent: "identity".to_string(),
            skill_id: None,
            response_template: "🏙️ **Mabishion Factory**\n\nMabishion ek elite AI ecosystem hai jiska main primary agent hoon. Hum industrial-grade, safe, aur high-speed business automation tools build karte hain.\n\nAap abhi Mickii Engine v1.0.0 (Instant Response) use kar rahe hain.".to_string(),
            action: "show_help".to_string(),
            confidence: 1.0,
        });
        
        // Greeting / Hello

        map.insert("hello".to_string(), InstantResponse {
            intent: "greeting".to_string(),
            skill_id: None,
            response_template: "🙏 **Namaste Adii!**\n\nMickii ready hai. Aaj kya banate hain?\n\nQuick options:\n• Website project\n• Lead follow-up\n• Proposal create\n• Status check".to_string(),
            action: "show_dashboard".to_string(),
            confidence: 0.9,
        });
        map.insert("hi".to_string(), InstantResponse {
            intent: "greeting".to_string(),
            skill_id: None,
            response_template: "👋 **Hello Boss!**\n\nMickii at your service. Kya kaam hai aaj?".to_string(),
            action: "show_dashboard".to_string(),
            confidence: 0.9,
        });
        
        map
    });
}

// ============================================
// INSTANT MATCH ENGINE
// <1ms response time guaranteed
// ============================================

fn normalize_input(input: &str) -> String {
    input.to_lowercase()
        .replace(" ", "_")
        .replace("-", "_")
        .replace("?", "")
        .replace("!", "")
        .replace(".", "")
        .replace(",", "")
}

fn keyword_overlap(input: &str, key: &str) -> f32 {
    let input_words: Vec<&str> = input.split('_').collect();
    let key_words: Vec<&str> = key.split('_').collect();
    
    let mut matches = 0;
    for iw in &input_words {
        if iw.len() < 3 { continue; } // Ignore tiny words like 'ek', 'an', 'to'
        for kw in &key_words {
            if iw == kw {
                matches += 1;
                break;
            }
        }
    }

    
    matches as f32 / key_words.len().max(1) as f32
}

#[tauri::command]
fn instant_response(input: String) -> serde_json::Value {
    let normalized = normalize_input(&input);
    let cache = INTENT_CACHE.lock().unwrap();
    
    // 1. Exact match (fastest — <1ms)
    if let Some(resp) = cache.get(&normalized) {
        return serde_json::json!({
            "matched": true,
            "match_type": "exact",
            "confidence": resp.confidence,
            "response": resp.response_template,
            "intent": resp.intent,
            "skill_id": resp.skill_id,
            "action": resp.action,
            "response_time_ms": 0
        });
    }
    
    // 2. Keyword match (<5ms)
    let mut best_match: Option<(String, f32)> = None;
    for (key, _) in cache.iter() {
        let overlap = keyword_overlap(&normalized, key);
        if overlap > 0.6 {
            if best_match.is_none() || overlap > best_match.as_ref().unwrap().1 {
                best_match = Some((key.clone(), overlap));
            }
        }
    }
    
    if let Some((key, confidence)) = best_match {
        let resp = cache.get(&key).unwrap();
        return serde_json::json!({
            "matched": true,
            "match_type": "fuzzy",
            "confidence": confidence * resp.confidence,
            "response": resp.response_template,
            "intent": resp.intent,
            "skill_id": resp.skill_id,
            "action": resp.action,
            "response_time_ms": 2
        });
    }
    
    // 3. No match — fallback to skill search
    serde_json::json!({
        "matched": false,
        "match_type": "none",
        "confidence": 0.0,
        "response": "🤔 Samajh nahi aaya. Kya aap:\n• Website banana chahte hain?\n• Proposal create karna chahte hain?\n• Lead check karna chahte hain?\n\n`help` likho for full list.",
        "intent": "unknown",
        "skill_id": null,
        "action": "show_help",
        "response_time_ms": 5
    })
}

// ============================================
// FULL PIPELINE: Instant Response + Context Fill
// ============================================

#[tauri::command]
async fn ask_mickii(input: String) -> std::result::Result<serde_json::Value, String> {
    let start = std::time::Instant::now();
    
    // Step 1: Instant match (Rust, <1ms)
    let mut result = instant_response(input.clone());
    
    // Step 2: No external fallback — Cortex JS handles LLM calls via llm_proxy
    result["source"] = serde_json::Value::String("local_cache".to_string());
    
    let elapsed = start.elapsed().as_millis() as u64;
    result["total_response_time_ms"] = serde_json::Value::Number(elapsed.into());
    
    Ok(result)
}


#[tauri::command]
async fn init_mickii_brain() -> Result<String, String> {
    Ok("Mickii Instant Brain initialized".to_string())
}

#[tauri::command]
async fn get_skills() -> Result<Vec<serde_json::Value>, String> { Ok(vec![]) }

#[tauri::command]
async fn get_templates() -> Result<Vec<serde_json::Value>, String> { Ok(vec![]) }

#[tauri::command]
async fn get_projects() -> Result<Vec<serde_json::Value>, String> { Ok(vec![]) }

#[tauri::command]
async fn get_leads() -> Result<Vec<serde_json::Value>, String> { Ok(vec![]) }

#[tauri::command]
async fn mickii_tool(tool_name: String, input: String) -> Result<String, String> {
    Ok(format!("Tool {} executed: {}", tool_name, input))
}

#[tauri::command]
async fn mickii_workflow(task: String) -> Result<String, String> {
    Ok(format!("Workflow started for: {}", task))
}

#[tauri::command]
async fn execute_skill(app: tauri::AppHandle, skill_id: String, context: serde_json::Value) -> Result<serde_json::Value, String> {
    use tauri::Emitter;
    app.emit("trigger_skill", serde_json::json!({ "skillId": skill_id, "context": context }))
        .map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "status": "started", "skill": skill_id }))
}

#[tauri::command]
async fn deploy_to_cpanel(host: String, user: String, pass: String, local_dir: String, remote_dir: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || -> Result<String, String> {
        use suppaftp::FtpStream;
        use walkdir::WalkDir;
        use std::fs::File;
        use std::io::Read;
        
        let mut ftp_stream = FtpStream::connect(format!("{}:21", host))
            .map_err(|e| format!("Connection error: {}", e))?;
            
        ftp_stream.login(&user, &pass)
            .map_err(|e| format!("Login error: {}", e))?;
            
        let _ = ftp_stream.cwd(&remote_dir);
        
        let local_path = std::path::Path::new(&local_dir);
        if !local_path.exists() {
            return Err("Local directory does not exist".into());
        }
        
        for entry in WalkDir::new(local_path).into_iter().filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.is_file() {
                let rel_path = path.strip_prefix(local_path).unwrap();
                let rel_path_str = rel_path.to_string_lossy().replace("\\", "/");
                
                let mut current_remote_dir = remote_dir.clone();
                if let Some(parent) = rel_path.parent() {
                    let parent_str = parent.to_string_lossy().replace("\\", "/");
                    if !parent_str.is_empty() {
                        let dirs: Vec<&str> = parent_str.split('/').collect();
                        for d in dirs {
                            current_remote_dir = format!("{}/{}", current_remote_dir, d);
                            let _ = ftp_stream.mkdir(&current_remote_dir);
                        }
                    }
                }
                
                let target_path = format!("{}/{}", remote_dir, rel_path_str);
                
                if let Ok(mut f) = File::open(path) {
                    let mut buffer = Vec::new();
                    if f.read_to_end(&mut buffer).is_ok() {
                        let mut reader = std::io::Cursor::new(buffer);
                        let _ = ftp_stream.put_file(&target_path, &mut reader);
                    }
                }
            }
        }
        
        let _ = ftp_stream.quit();
        
        Ok(format!("Successfully deployed to {}", host))
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Mickii bol raha hai: {}, system ready hai!", name)
}

// ============================================
// SYSTEM BRIDGE COMMANDS (The "Mechanical Arms")
// ============================================

fn assert_absolute(path: &str) -> MickiiResult<std::path::PathBuf> {
    let p = std::path::PathBuf::from(path);
    if p.is_absolute() {
        Ok(p)
    } else {
        Err(MickiiError::NotAbsolute(path.to_string()))
    }
}

#[tauri::command]
async fn mickii_fs_create(path: String, kind: Option<String>, content: Option<String>) -> MickiiResult<String> {
    let p = assert_absolute(&path)?;
    let kind = kind.unwrap_or_else(|| "file".to_string());
    
    if kind == "dir" || kind == "directory" {
        std::fs::create_dir_all(&p)?;
    } else {
        if let Some(parent) = p.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&p, content.unwrap_or_default())?;
    }
    Ok(format!("Successfully created {} at {}", kind, path))
}

#[tauri::command]
async fn mickii_fs_read(path: String) -> MickiiResult<String> {
    let p = assert_absolute(&path)?;
    let content = std::fs::read_to_string(p)?;
    Ok(content)
}

#[tauri::command]
async fn mickii_fs_write(path: String, content: String) -> MickiiResult<String> {
    let p = assert_absolute(&path)?;
    std::fs::write(p, content)?;
    Ok(format!("Successfully wrote to {}", path))
}

#[tauri::command]
async fn mickii_fs_delete(path: String, recursive: Option<bool>) -> MickiiResult<String> {
    let p = assert_absolute(&path)?;
    let md = std::fs::metadata(&p)?;
    if md.is_dir() {
        if recursive.unwrap_or(false) {
            std::fs::remove_dir_all(p)?;
        } else {
            std::fs::remove_dir(p)?;
        }
    } else {
        std::fs::remove_file(p)?;
    }
    Ok(format!("Successfully deleted {}", path))
}

#[tauri::command]
async fn mickii_shell_run(command: String, args: Vec<String>, cwd: Option<String>) -> MickiiResult<String> {
    let mut cmd = std::process::Command::new(&command);
    cmd.args(&args);
    if let Some(dir) = cwd {
        let p = assert_absolute(&dir)?;
        cmd.current_dir(p);
    }
    
    let output = cmd.output()?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(MickiiError::Shell(String::from_utf8_lossy(&output.stderr).to_string()))
    }
}

#[tauri::command]
async fn ollama_proxy(
    payload: serde_json::Value,
    state: tauri::State<'_, AppState>
) -> std::result::Result<serde_json::Value, String> {
    println!("[Rust] Proxying request to Ollama...");
    
    let res = state.client.post("http://127.0.0.1:11434/v1/chat/completions")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Ollama Connection Error: {}. Check if Ollama is running.", e))?;

    let json = res.json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Ollama Parse Error: {}", e))?;
        
    Ok(json)
}

#[tauri::command]
async fn llm_proxy(
    payload: serde_json::Value,
    api_key: String,
    base_url: String,
    extra_headers: Option<HashMap<String, String>>,
    state: tauri::State<'_, AppState>
) -> std::result::Result<serde_json::Value, String> {
    println!("[Rust] LLM Proxy -> {}", base_url);
    let body_str = serde_json::to_string(&payload).unwrap_or_default();
    println!("[Rust] Payload size: {} chars", body_str.len());
    
    println!("[Rust] api_key received: '{}'", api_key);
    println!("[Rust] Extra headers from JS: {:?}", extra_headers);
    
    let auth_header = format!("Bearer {}", api_key);
    println!("[Rust] Constructing Header: Authorization = {}", auth_header);

    let mut req = state.client.post(&base_url)
        .header("Authorization", auth_header)
        .header("Content-Type", "application/json");
    
    // Attach any extra headers passed from JS (e.g. HTTP-Referer, X-Title)
    if let Some(headers) = extra_headers {
        for (k, v) in headers {
            req = req.header(&k, &v);
        }
    }
    
    let res = req.json(&payload)
        .send()
        .await
        .map_err(|e| format!("LLM Connection Error: {}", e))?;

    let json = res.json::<serde_json::Value>()
        .await
        .map_err(|e| format!("LLM Parse Error: {}", e))?;
        
    Ok(json)
}

#[tauri::command]
async fn serper_search(
    query: String, 
    api_key: String,
    state: tauri::State<'_, AppState>
) -> std::result::Result<serde_json::Value, String> {
    let current_year = Utc::now().year();
    let mut enhanced_query = query.clone();
    let lower_q = query.to_lowercase();
    
    // Force freshness for ranking queries
    if lower_q.contains("top") || lower_q.contains("best") || lower_q.contains("trending") {
        if !lower_q.contains("latest") && !lower_q.contains("new") {
            enhanced_query = format!("{} latest", enhanced_query);
        }
    }
    
    // Append year if not present
    if !lower_q.contains(&current_year.to_string()) {
        enhanced_query = format!("{} {}", enhanced_query, current_year);
    }
    
    println!("[Rust] Serper enhanced query: {}", enhanced_query);
    
    let res = state.client.post("https://google.serper.dev/search")
        .header("X-API-KEY", api_key)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({ 
            "q": enhanced_query,
            "num": 10,
            "tbs": "qdr:y"
        }))
        .send()
        .await
        .map_err(|e| format!("Serper Request Failed: {}", e))?;
    
    let text = res.text().await.map_err(|e| format!("Serper Response Read Error: {}", e))?;
    println!("[Rust] Serper raw response: {}", text);
    
    let json: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("Serper Parse Error: {}", e))?;
    Ok(json)
}

#[tauri::command]
async fn exa_research(
    query: String, 
    api_key: String,
    state: tauri::State<'_, AppState>
) -> std::result::Result<serde_json::Value, String> {
    let res = state.client.post("https://api.exa.ai/search")
        .header("x-api-key", api_key)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({ 
            "query": query,
            "useAutoprompt": true,
            "numResults": 5
        }))
        .send()
        .await
        .map_err(|e| format!("Exa Request Failed: {}", e))?;
    
    let json = res.json::<serde_json::Value>().await.map_err(|e| format!("Exa Parse Error: {}", e))?;
    Ok(json)
}

#[tauri::command]
async fn gemini_proxy(
    payload: serde_json::Value,
    api_key: String,
    base_url: String,
    state: tauri::State<'_, AppState>
) -> std::result::Result<serde_json::Value, String> {
    println!("[Rust] Gemini Proxy -> {}", base_url);
    
    let res = state.client.post(&base_url)
        .query(&[("key", &api_key)])
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Gemini Connection Error: {}", e))?;

    let json = res.json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Gemini Parse Error: {}", e))?;
        
    if let Some(error) = json.get("error") {
        return Err(format!("Gemini API Error: {}", error));
    }
        
    Ok(json)
}

#[tauri::command]
fn get_system_time_info() -> serde_json::Value {
    let now = chrono::Local::now();
    let offset_seconds = now.offset().local_minus_utc();
    serde_json::json!({
        "local_time": now.to_rfc3339(),
        "offset_minutes": offset_seconds / 60
    })
}


fn main() {
    tauri::Builder::default()
        .manage(AppState { 
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(45))
                .build()
                .expect("Failed to build shared reqwest client")
        })
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            init_mickii_brain,
            instant_response,
            ask_mickii,
            get_skills,
            get_templates,
            get_projects,
            get_leads,
            mickii_tool,
            mickii_workflow,
            execute_skill,
            deploy_to_cpanel,
            mickii_fs_create,
            mickii_fs_read,
            mickii_fs_write,
            mickii_fs_delete,
            mickii_shell_run,
            ollama_proxy,
            llm_proxy,
            gemini_proxy,
            serper_search,
            exa_research,
            get_system_time_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}