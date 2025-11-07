// Copyright 2025 ccflare team
// SPDX-License-Identifier: MIT

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{command, generate_handler, Builder, Manager, State, WindowEvent};
use tokio::sync::Mutex;


// Server process management  
#[derive(Clone)]
struct ServerState {
    process: Arc<Mutex<Option<std::process::Child>>>,
}


#[derive(Debug, Serialize, Deserialize)]
struct ServerStatus {
    running: bool,
    port: u16,
    pid: Option<u32>,
}


#[command]
async fn start_server(state: State<'_, ServerState>) -> Result<ServerStatus, String> {
    let mut process_guard = state.process.lock().await;
    
    // Check if server is already running
    if let Some(ref mut child) = process_guard.as_mut() {
        match child.try_wait() {
            Ok(Some(_)) => {
                // Process has exited, remove it
                *process_guard = None;
            }
            Ok(None) => {
                // Process is still running
                // Still set the environment variable in case it wasn't set
                set_anthropic_env_var();
                return Ok(ServerStatus {
                    running: true,
                    port: 8081,
                    pid: Some(child.id()),
                });
            }
            Err(_) => {
                // Error checking process, assume it's dead
                *process_guard = None;
            }
        }
    }

    // Set the environment variable before starting the server
    set_anthropic_env_var();

    // Start new server process - use bun to run the server
    let mut cmd = Command::new("bun");
    
    // Get the project root directory (5 levels up from the executable)
    let project_root = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))  // target/debug
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))  // target
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))  // src-tauri
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))  // desktop
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))  // apps
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))  // ccflare root
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    
    cmd.args(&["run", "server"])
        .current_dir(&project_root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // On Windows, hide the console window for the bun process
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    match cmd.spawn() {
        Ok(child) => {
            let pid = child.id();
            *process_guard = Some(child);
            
            Ok(ServerStatus {
                running: true,
                port: 8081,
                pid: Some(pid),
            })
        }
        Err(e) => Err(format!("Failed to start server: {}", e)),
    }
}

#[command]
async fn stop_server(state: State<'_, ServerState>) -> Result<ServerStatus, String> {
    let mut process_guard = state.process.lock().await;
    
    // Remove environment variable when manually stopping the server
    remove_anthropic_env_var();
    
    if let Some(mut child) = process_guard.take() {
        match child.kill() {
            Ok(_) => {
                let _ = child.wait(); // Wait for process to fully terminate
                Ok(ServerStatus {
                    running: false,
                    port: 8081,
                    pid: None,
                })
            }
            Err(e) => Err(format!("Failed to stop server: {}", e)),
        }
    } else {
        Ok(ServerStatus {
            running: false,
            port: 8081,
            pid: None,
        })
    }
}

#[command]
async fn get_server_status(state: State<'_, ServerState>) -> Result<ServerStatus, String> {
    let mut process_guard = state.process.lock().await;
    
    if let Some(ref mut child) = process_guard.as_mut() {
        match child.try_wait() {
            Ok(Some(_)) => {
                // Process has exited
                *process_guard = None;
                Ok(ServerStatus {
                    running: false,
                    port: 8081,
                    pid: None,
                })
            }
            Ok(None) => {
                // Process is still running
                Ok(ServerStatus {
                    running: true,
                    port: 8081,
                    pid: Some(child.id()),
                })
            }
            Err(e) => Err(format!("Error checking server status: {}", e)),
        }
    } else {
        Ok(ServerStatus {
            running: false,
            port: 8081,
            pid: None,
        })
    }
}

#[command]
async fn check_server_health() -> Result<bool, String> {
    let client = reqwest::Client::new();
    match client.get("http://localhost:8081/health").send().await {
        Ok(response) => Ok(response.status().is_success()),
        Err(_) => Ok(false),
    }
}

#[command]
async fn exit_app(state: State<'_, ServerState>) -> Result<(), String> {
    println!("🔔 Exit command received, cleaning up...");
    cleanup_server(state.inner().clone()).await;
    std::process::exit(0);
}

fn set_anthropic_env_var() {
    println!("🔧 Setting ANTHROPIC_BASE_URL=http://localhost:8081");
    std::env::set_var("ANTHROPIC_BASE_URL", "http://localhost:8081");
    
    // Also set it system-wide on Windows
    #[cfg(target_os = "windows")]
    {
        println!("🔧 Setting system-wide environment variable...");
        let result = Command::new("setx")
            .args(&["ANTHROPIC_BASE_URL", "http://localhost:8081"])
            .output();
        
        match result {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                if output.status.success() {
                    println!("✅ ANTHROPIC_BASE_URL set system-wide successfully");
                    if !stdout.trim().is_empty() {
                        println!("  Output: {}", stdout.trim());
                    }
                } else {
                    eprintln!("⚠️ Failed to set system-wide env var - setx failed");
                    if !stderr.trim().is_empty() {
                        eprintln!("  Error: {}", stderr.trim());
                    }
                    if !stdout.trim().is_empty() {
                        eprintln!("  Output: {}", stdout.trim());
                    }
                }
            }
            Err(e) => eprintln!("⚠️ Failed to execute setx command: {}", e),
        }
    }
}

fn remove_anthropic_env_var() {
    println!("🧹 Removing ANTHROPIC_BASE_URL environment variable");
    std::env::remove_var("ANTHROPIC_BASE_URL");
    
    // Also remove it system-wide on Windows
    #[cfg(target_os = "windows")]
    {
        println!("🧹 Removing system-wide environment variable...");
        let result = Command::new("reg")
            .args(&["delete", "HKCU\\Environment", "/v", "ANTHROPIC_BASE_URL", "/f"])
            .output();
        
        match result {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                if output.status.success() {
                    println!("✅ ANTHROPIC_BASE_URL removed system-wide successfully");
                } else {
                    eprintln!("⚠️ Failed to remove system-wide env var - reg command failed");
                    if !stderr.trim().is_empty() {
                        eprintln!("  Error: {}", stderr.trim());
                    }
                    if !stdout.trim().is_empty() {
                        eprintln!("  Output: {}", stdout.trim());
                    }
                }
            }
            Err(e) => eprintln!("⚠️ Failed to execute reg command: {}", e),
        }
    }
}

async fn cleanup_server(state: ServerState) {
    let mut process_guard = state.process.lock().await;
    
    println!("🛑 Stopping ccflare server...");
    
    // Remove environment variable first
    remove_anthropic_env_var();
    
    // First try to kill the tracked process
    if let Some(mut child) = process_guard.take() {
        match child.kill() {
            Ok(_) => {
                let _ = child.wait(); // Wait for process to fully terminate
                println!("✅ ccflare server process stopped");
            }
            Err(e) => {
                eprintln!("⚠️ Failed to stop tracked process: {}", e);
            }
        }
    }
    
    // Also try to kill any process using port 8081 (Windows-specific)
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("cmd")
            .args(&["/C", "netstat -ano | findstr :8081"])
            .output();
            
        if let Ok(output) = output {
            let output_str = String::from_utf8_lossy(&output.stdout);
            for line in output_str.lines() {
                if line.contains("LISTENING") {
                    // Extract PID from the line (last column)
                    if let Some(pid_str) = line.split_whitespace().last() {
                        if let Ok(pid) = pid_str.parse::<u32>() {
                            println!("🔍 Found process {} using port 8081, attempting to kill...", pid);
                            let kill_result = Command::new("taskkill")
                                .args(&["/PID", &pid.to_string(), "/F"])
                                .output();
                            
                            match kill_result {
                                Ok(_) => println!("✅ Killed process {} on port 8081", pid),
                                Err(e) => eprintln!("⚠️ Failed to kill process {}: {}", pid, e),
                            }
                        }
                    }
                }
            }
        }
    }
    
    // For other platforms, try to find and kill node/bun processes
    #[cfg(not(target_os = "windows"))]
    {
        let _ = Command::new("pkill")
            .args(&["-f", "bun.*ccflare"])
            .output();
        println!("✅ Attempted to kill ccflare processes");
    }
}

async fn auto_start_server(state: ServerState) -> Result<(), String> {
    let mut process_guard = state.process.lock().await;
    
    // Check if server is already running
    if let Some(ref mut child) = process_guard.as_mut() {
        match child.try_wait() {
            Ok(Some(_)) => {
                // Process has exited, remove it
                *process_guard = None;
            }
            Ok(None) => {
                // Process is still running, no need to start another
                println!("Server is already running");
                // Still set the environment variable in case it wasn't set
                set_anthropic_env_var();
                return Ok(());
            }
            Err(_) => {
                // Error checking process, assume it's dead
                *process_guard = None;
            }
        }
    }

    // Set the environment variable before starting the server
    set_anthropic_env_var();

    // Start new server process - use bun to run the server
    let mut cmd = Command::new("bun");
    
    // Get the project root directory (5 levels up from the executable)
    let project_root = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))  // target/debug
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))  // target
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))  // src-tauri
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))  // desktop
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))  // apps
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))  // ccflare root
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    
    cmd.args(&["run", "server"])
        .current_dir(&project_root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // On Windows, hide the console window for the bun process
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    match cmd.spawn() {
        Ok(child) => {
            println!("✅ ccflare server started automatically (PID: {})", child.id());
            *process_guard = Some(child);
            Ok(())
        }
        Err(e) => {
            eprintln!("❌ Failed to start server: {}", e);
            Err(format!("Failed to start server: {}", e))
        }
    }
}



fn main() {
    Builder::default()
        .manage(ServerState {
            process: Arc::new(Mutex::new(None)),
        })
        .invoke_handler(generate_handler![
            start_server,
            stop_server,
            get_server_status,
            check_server_health,
            exit_app
        ])
        .setup(move |app| {
            println!("🚀 ccflare Desktop started - ANTHROPIC_BASE_URL will be automatically set to http://localhost:8081");
            
            // Auto-start the ccflare server when the desktop app launches
            let state = app.state::<ServerState>();
            let state_clone = state.inner().clone();
            
            tauri::async_runtime::spawn(async move {
                if let Err(e) = auto_start_server(state_clone).await {
                    eprintln!("Failed to auto-start server: {}", e);
                }
            });

            // Set up cleanup on window close and app exit
            let state_for_cleanup = app.state::<ServerState>();
            let cleanup_state = state_for_cleanup.inner().clone();
            
            // Register cleanup for window close event
            if let Some(main_window) = app.get_webview_window("main") {
                let cleanup_state_window = cleanup_state.clone();
                let window_for_destroy = main_window.clone();
                let is_cleaning_up = Arc::new(AtomicBool::new(false));
                let is_cleaning_up_clone = is_cleaning_up.clone();

                main_window.on_window_event(move |event| {
                    match event {
                        WindowEvent::CloseRequested { api, .. } => {
                            // Check if we're already cleaning up to prevent infinite loop
                            if is_cleaning_up_clone.compare_exchange(
                                false,
                                true,
                                Ordering::SeqCst,
                                Ordering::SeqCst
                            ).is_ok() {
                                println!("🔔 Window close requested, cleaning up...");
                                // Prevent window from closing immediately
                                api.prevent_close();

                                let cleanup_state = cleanup_state_window.clone();
                                let window_clone = window_for_destroy.clone();

                                // Spawn cleanup task and destroy window after it completes
                                std::thread::spawn(move || {
                                    tauri::async_runtime::block_on(async {
                                        cleanup_server(cleanup_state).await;
                                        println!("✅ Cleanup complete, destroying window...");
                                        // Destroy the window instead of close to avoid triggering the event again
                                        let _ = window_clone.destroy();
                                    });
                                });
                            } else {
                                println!("⚠️ Cleanup already in progress, ignoring duplicate close request");
                            }
                        }
                        _ => {}
                    }
                });
            }

            // The window close event should be sufficient for cleanup
            // If it doesn't work, we'll also add an explicit exit command
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}