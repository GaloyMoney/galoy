"use client"
import * as React from "react"
import GlobalStyles from "@mui/joy/GlobalStyles"
import IconButton from "@mui/joy/IconButton"
import Sheet from "@mui/joy/Sheet"
import MenuRoundedIcon from "@mui/icons-material/MenuRounded"
import ContentCopyIcon from "@mui/icons-material/ContentCopy"

import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined"
import { Avatar, Box, Menu, MenuItem, Dropdown, MenuButton, Typography } from "@mui/joy"
import { signOut, useSession } from "next-auth/react"

import Heading from "./heading"
import { toggleSidebar } from "./utils"
import ColorSchemeToggle from "./color-toggle"

export default function Header() {
  const session = useSession()
  const userData = session?.data?.userData?.data.me

  if (!userData) {
    return null
  }

  return (
    <Sheet
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        top: 0,
        width: {
          xs: "100vw",
          md: "calc(100vw - var(--Sidebar-width))",
        },
        height: "var(--Header-height)",
        zIndex: 9998,
        p: 2,
        gap: 1,
        borderBottom: "2px solid",
        borderColor: "background.level1",
      }}
    >
      <GlobalStyles
        styles={() => ({
          ":root": {
            "--Header-height": "4em",
          },
        })}
      />
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: "1em",
        }}
      >
        <IconButton
          onClick={() => toggleSidebar()}
          variant="outlined"
          size="sm"
          sx={{ display: { xs: "block", md: "none" } }}
        >
          <MenuRoundedIcon />
        </IconButton>
        <Heading />
      </Box>

      <Dropdown>
        <MenuButton
          slots={{ root: IconButton }}
          slotProps={{
            root: { variant: "outlined", color: "neutral" },
          }}
          sx={{ border: "none" }}
        >
          <Avatar />
        </MenuButton>
        <Menu
          sx={{
            zIndex: 9999,
            gap: "0.5em",
          }}
          placement="bottom-end"
        >
          <MenuItem
            onClick={() => navigator.clipboard.writeText(userData?.defaultAccount.id)}
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
            }}
          >
            <Box
              sx={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <Typography
                sx={{
                  fontWeight: "500",
                }}
              >
                Account ID
              </Typography>
              <ContentCopyIcon></ContentCopyIcon>
            </Box>
            <Typography
              sx={{
                fontSize: "0.8em",
                color: "text.secondary",
              }}
            >
              {" "}
              {userData?.defaultAccount.id}
            </Typography>
          </MenuItem>
          <MenuItem
            onClick={() => signOut()}
            sx={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: "500",
            }}
          >
            Logout
            <LogoutOutlinedIcon></LogoutOutlinedIcon>
          </MenuItem>
          <ColorSchemeToggle></ColorSchemeToggle>
        </Menu>
      </Dropdown>
    </Sheet>
  )
}
