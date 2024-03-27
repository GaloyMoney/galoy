load(
    "@prelude//test/inject_test_run_info.bzl",
    "inject_test_run_info",
)

load("@prelude//python:toolchain.bzl", "PythonToolchainInfo",)
load(":toolchain.bzl", "RoverToolchainInfo",)

def dev_update_file_impl(ctx: AnalysisContext) -> list[[DefaultInfo, RunInfo]]:
    script = ctx.actions.write("update-file.sh", """\
#!/usr/bin/env bash
set -euo pipefail

rootpath="$(git rev-parse --show-toplevel)"
package_path="$1"
generated_file="$2"
out_path="$3"

cd "$rootpath/$package_path"
cp "${generated_file}" "${out_path}"
""", is_executable = True)
    args = cmd_args(script, ctx.label.package, ctx.attrs.generated, ctx.attrs.out)
    return [DefaultInfo(), RunInfo(args = args)]

dev_update_file = rule(impl = dev_update_file_impl, attrs = {
    "generated": attrs.source(),
    "out": attrs.string(),
})

def diff_impl(
    ctx: AnalysisContext,
) -> list[[
    DefaultInfo,
    RunInfo,
    ExternalRunnerTestInfo,
]]:

    run_cmd_args = cmd_args(
        "diff",
        ctx.attrs.original,
        ctx.attrs.new,
    )

    args_file = ctx.actions.write("args.txt", run_cmd_args)

    return inject_test_run_info(
        ctx,
        ExternalRunnerTestInfo(
            type = "diff",
            command = [run_cmd_args],
        ),
    ) + [
        DefaultInfo(default_output = args_file),
    ]

diff_check = rule(
    impl = diff_impl,
    attrs = {
        "original": attrs.source(
            doc = """The original file on disk""",
        ),
        "new": attrs.source(
            doc = """The newly generated output""",
        ),
        "_inject_test_env": attrs.default_only(
            attrs.dep(default = "prelude//test/tools:inject_test_env"),
        ),
    },
)

def supergraph_impl(ctx: AnalysisContext) -> list[DefaultInfo]:
    out = ctx.actions.declare_output("supergraph.graphql")

    rover_toolchain = ctx.attrs._rover_toolchain[RoverToolchainInfo]

    cmd = cmd_args(
        ctx.attrs._python_toolchain[PythonToolchainInfo].interpreter,
        rover_toolchain.generate_supergraph[DefaultInfo].default_outputs,
        "--rover-bin",
        ctx.attrs.rover_bin[RunInfo],
        "--config",
        ctx.attrs.config,
    )
    for (var, sub) in ctx.attrs.subgraphs.items():
        cmd.add(
            "--subgraph",
            cmd_args([var, sub], delimiter = "="),
        )
    cmd.add(out.as_output())

    ctx.actions.run(cmd, category = "supergraph")
    return [DefaultInfo(default_output = out)]

supergraph = rule(
    impl = supergraph_impl,
    attrs = {
        "rover_bin": attrs.dep(
            providers = [RunInfo],
            default = "root//third-party/node/rover:rover_bin",
            doc = """Rover dependency.""",
        ),
        "config": attrs.source(
            doc = """Configuration file to use for the supergraph""",
        ),
        "subgraphs": attrs.dict(
            key = attrs.string(),
            value = attrs.source(),
            default = {},
            doc = """List of all schema subgraphs""",
        ),
        "_python_toolchain": attrs.toolchain_dep(
            default = "toolchains//:python",
            providers = [PythonToolchainInfo],
        ),
        "_rover_toolchain": attrs.toolchain_dep(
            default = "toolchains//:rover",
            providers = [RoverToolchainInfo],
        ),
    },
)

def sdl_impl(ctx: AnalysisContext) -> list[DefaultInfo]:
    out = ctx.actions.declare_output("schema.graphql")

    rover_toolchain = ctx.attrs._rover_toolchain[RoverToolchainInfo]

    cmd = cmd_args(
        ctx.attrs._python_toolchain[PythonToolchainInfo].interpreter,
        rover_toolchain.output_sdl[DefaultInfo].default_outputs,
        "--generator-bin",
        ctx.attrs.generator[RunInfo],
    )
    for arg in ctx.attrs.args:
        cmd.add("--arg", arg)
    cmd.add(
        out.as_output()
    )

    for deps_src in ctx.attrs.deps_srcs:
        cmd.hidden(deps_src)

    ctx.actions.run(cmd, category = "sdl")
    return [DefaultInfo(default_output = out)]

sdl = rule(
    impl = sdl_impl,
    attrs = {
        "generator": attrs.exec_dep(
            providers = [RunInfo],
            doc = """Generator that will output the sdl""",
        ),
        "args": attrs.list(
            attrs.string(),
            default = [],
        ),
        "deps_srcs": attrs.list(
            attrs.source(),
            default = [],
            doc = """Source files that the generator will depends on""",
        ),
        "_python_toolchain": attrs.toolchain_dep(
            default = "toolchains//:python",
            providers = [PythonToolchainInfo],
        ),
        "_rover_toolchain": attrs.toolchain_dep(
            default = "toolchains//:rover",
            providers = [RoverToolchainInfo],
        ),
    },
)
