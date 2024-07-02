"use client"
import React from "react"

import { Box } from "@mui/joy"
import { Typography, useMediaQuery, useTheme } from "@mui/material"

import { usePathname } from "next/navigation"

import { URLS } from "@/app/url"

export function getTitle(path: string): {
  title: string
  badge?: string
} {
  const urlInfo = URLS[path]
  if (urlInfo) {
    return urlInfo
  }
  return {
    title: "Path not found",
  }
}

const Heading = () => {
  const pathName = usePathname()
  const pageInfo = getTitle(pathName)
  const theme = useTheme()
  const isMobileDevice = useMediaQuery(theme.breakpoints.down("sm"))

  return (
    <Box
      sx={{
        display: "flex",
        my: 2,
        gap: 1,
        alignItems: { sm: "center" },
        flexWrap: "wrap",
        justifyContent: "space-between",
      }}
    >
      <Typography variant={isMobileDevice ? "h3" : "h2"}>{pageInfo.title}</Typography>
      <Typography
        sx={{
          color: "grey",
          fontSize: "1em",
          marginTop: "0.8em",
        }}
        variant="h4"
      >
        {pageInfo.badge}
      </Typography>
    </Box>
  )
}

export default Heading
