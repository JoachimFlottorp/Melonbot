use rlua::Value;

use crate::{
    error::Errors,
    lua::{cleanup, create_lua_ctx, stringify, wrap_as_readonly},
    types::{Channel, Invoker},
};

/// State for one request
pub struct State {
    pub lua: rlua::Lua,
    pub channel: Channel,
    pub invoker: Invoker,
}

impl State {
    pub fn new(channel: Channel, invoker: Invoker) -> Result<Self, rlua::Error> {
        let lua = create_lua_ctx()?;

        lua.context(|ctx| cleanup::cleanup_bad_globals(&ctx))?;

        Ok(Self {
            lua,
            channel,
            invoker,
        })
    }

    pub fn execute(self, command: &str, args: Vec<&str>) -> Result<String, Errors> {
        self.lua.context(|ctx| {
            let script = format!(
                r#"
                    local command = GetCommandByName("{}")

                    if command == nil then
                        error("Command not found", 2)
                    end

                    return command
            "#,
                command
            );

            let table = match ctx
                .load(&script)
                .set_name(&format!("Load {}", command))?
                .eval::<Value>()?
            {
                Value::Table(t) => t,
                _ => return Err(Errors::CommandNotFound),
            };

            log::info!("Executing command: {}", command);

            wrap_as_readonly(&ctx, "Channel", self.channel)?;
            wrap_as_readonly(&ctx, "Invoker", self.invoker)?;

            let response = table
                .get::<&str, rlua::Function>("execute")?
                .call::<_, Value>(args);

            match response {
                Ok(r) => stringify(r),
                Err(e) => {
                    log::error!("Error executing command: {}", e);
                    return Err(Errors::LuaError(e));
                }
            }
        })
    }
}