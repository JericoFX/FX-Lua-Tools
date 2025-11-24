-- Manual cases for lexer-aware diagnostics

--[[
while true do
  -- Block comment should be ignored
end
]]

local script = [[
repeat
  print('inside long string')
until false
]]

local quoted = "repeat\n  Wait(0)\nuntil value" -- inline string should be ignored

-- this is a repeat but inside comment repeat until

while condition do
  --[[ nested [[ comment ]] should be ignored ]]
  Citizen.Wait(0)
end

repeat
  local value = GetPlayerPed(-1) -- performance hint should trigger here
  Wait(0)
until finished

-- Ensure global detection ignores strings
"RegisterNetEvent('not a real call')"

function test()
  local inside = true
  if inside then return end
end
