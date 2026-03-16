//! Hone Plugin CLI — scaffold, build, test, dev, package, and publish plugins.

use clap::{Parser, Subcommand};

mod new;
mod build;
mod dev;
mod test;
mod pack;
mod publish;

#[derive(Parser)]
#[command(name = "hone-plugin", about = "Hone plugin development tools")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Scaffold a new plugin from templates
    New {
        /// Plugin name (lowercase, hyphens only)
        name: String,

        /// Plugin author name
        #[arg(long, default_value = "Plugin Author")]
        author: String,
    },

    /// Compile the plugin to a .dylib
    Build {
        /// Path to perry compiler (default: searches PATH)
        #[arg(long)]
        perry: Option<String>,
    },

    /// Watch source files and rebuild on change
    Dev {
        /// Path to perry compiler
        #[arg(long)]
        perry: Option<String>,

        /// Poll interval in milliseconds
        #[arg(long, default_value = "500")]
        interval: u64,
    },

    /// Run plugin tests
    Test,

    /// Create a .honepkg archive
    Pack {
        /// Output directory for the .honepkg file
        #[arg(short, long, default_value = ".")]
        output: String,
    },

    /// Publish to the Hone Plugin Marketplace
    Publish {
        /// Authentication token (or reads from ~/.hone/marketplace-token)
        #[arg(long)]
        token: Option<String>,

        /// Marketplace API URL
        #[arg(long)]
        marketplace_url: Option<String>,
    },
}

fn main() {
    let cli = Cli::parse();

    let result = match cli.command {
        Commands::New { name, author } => new::run(&name, &author),
        Commands::Build { perry } => build::run(perry.as_deref()),
        Commands::Dev { perry, interval } => dev::run(perry.as_deref(), interval),
        Commands::Test => test::run(),
        Commands::Pack { output } => pack::run(&output),
        Commands::Publish { token, marketplace_url } => {
            publish::run(token.as_deref(), marketplace_url.as_deref())
        }
    };

    if let Err(e) = result {
        eprintln!("Error: {}", e);
        std::process::exit(1);
    }
}
