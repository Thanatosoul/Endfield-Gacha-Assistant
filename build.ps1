# build-tauri-nsis.ps1

$ErrorActionPreference = "Stop"

try {
    Write-Host "=== 开始构建 Tauri NSIS 安装包 ===" -ForegroundColor Cyan
    Write-Host "当前目录: $(Get-Location)" -ForegroundColor Yellow
    
    # 检查 package.json 是否存在
    if (-not (Test-Path "package.json")) {
        throw "未找到 package.json 文件，请确保在项目根目录运行此脚本"
    }
    
    # 运行 npm 命令
    Write-Host "正在执行: npm run tauri:build:windows:nsis" -ForegroundColor Yellow
    npm run tauri:build:windows:nsis
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Tauri NSIS 构建成功！" -ForegroundColor Green
        Write-Host "安装包位置请查看 src-tauri/target/release/bundle/nsis/" -ForegroundColor Green
    } else {
        throw "构建失败，退出代码: $LASTEXITCODE"
    }
    
} catch {
    Write-Host "❌ 错误: $_" -ForegroundColor Red
    Exit 1
} finally {
    Write-Host "=== 构建脚本执行完毕 ===" -ForegroundColor Cyan
}

# 暂停以便查看结果（双击运行时有用）
Read-Host "按任意键退出..."