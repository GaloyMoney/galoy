"use client"
import * as React from "react"
import { useColorScheme } from "@mui/joy/styles"

import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded"
import LightModeIcon from "@mui/icons-material/LightMode"
import { MenuItem } from "@mui/joy"

export default function ColorSchemeToggle() {
  const { mode, setMode } = useColorScheme()
  return (
    <MenuItem
      onClick={() => {
        if (mode === "light") {
          setMode("dark")
        } else {
          setMode("light")
        }
      }}
      sx={{
        display: "flex",
        justifyContent: "space-between",
        fontWeight: "500",
      }}
    >
      {mode === "light" ? "Dark Mode" : "Light Mode"}
      {mode === "light" ? <DarkModeRoundedIcon /> : <LightModeIcon />}
    </MenuItem>
  )
}
