// Copyright 2025 ccflare team
// SPDX-License-Identifier: MIT

//! Server management utilities for ccflare desktop app

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub port: u16,
    pub host: String,
    pub auto_start: bool,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            port: 8081,
            host: "localhost".to_string(),
            auto_start: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerInfo {
    pub config: ServerConfig,
    pub running: bool,
    pub pid: Option<u32>,
    pub uptime: Option<u64>,
}

impl ServerInfo {
    pub fn new(config: ServerConfig) -> Self {
        Self {
            config,
            running: false,
            pid: None,
            uptime: None,
        }
    }
    
    pub fn url(&self) -> String {
        format!("http://{}:{}", self.config.host, self.config.port)
    }
}