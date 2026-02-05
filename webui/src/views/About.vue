<template>
  <div class="about">
    <div class="header-section">
      <div class="logo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          <path d="M12 11v6M9 14h6"/>
        </svg>
      </div>
      <h1>存储重定向与审计</h1>
      <p class="version">版本 1.0.0</p>
    </div>

    <div class="info-card">
      <h3>功能介绍</h3>
      <ul class="feature-list">
        <li>
          <span class="icon">📁</span>
          <div>
            <strong>重定向</strong>
            <p>将应用访问的源路径重定向到目标路径，支持多条规则优先级</p>
          </div>
        </li>
        <li>
          <span class="icon">🔒</span>
          <div>
            <strong>只读控制</strong>
            <p>禁止应用写入指定路径，保护重要目录</p>
          </div>
        </li>
        <li>
          <span class="icon">📊</span>
          <div>
            <strong>访问监控</strong>
            <p>记录应用的文件访问操作，便于审计分析</p>
          </div>
        </li>
        <li>
          <span class="icon">⚡</span>
          <div>
            <strong>动态生效</strong>
            <p>规则修改无需重启设备或应用，实时生效</p>
          </div>
        </li>
      </ul>
    </div>

    <div class="info-card">
      <h3>使用说明</h3>
      <div class="usage-steps">
        <div class="step">
          <span class="step-num">1</span>
          <p>在"应用"页面选择要配置的应用</p>
        </div>
        <div class="step">
          <span class="step-num">2</span>
          <p>添加重定向、只读或监控规则</p>
        </div>
        <div class="step">
          <span class="step-num">3</span>
          <p>开启应用开关使规则生效</p>
        </div>
        <div class="step">
          <span class="step-num">4</span>
          <p>在"监控"页面查看访问日志</p>
        </div>
      </div>
    </div>

    <div class="info-card">
      <h3>兼容性</h3>
      <ul class="compat-list">
        <li>
          <span class="check">✓</span>
          <span>Android 12 - 16</span>
        </li>
        <li>
          <span class="check">✓</span>
          <span>KernelSU / APatch</span>
        </li>
        <li>
          <span class="check">✓</span>
          <span>arm64-v8a</span>
        </li>
      </ul>
    </div>

    <div class="info-card warning-card">
      <h3>⚠️ 注意事项</h3>
      <ul class="warning-list">
        <li>本模块需要 Root 权限和 Zygisk 环境</li>
        <li>配置规则前请备份重要数据</li>
        <li>部分系统应用可能无法完全拦截</li>
        <li>过度监控可能影响性能</li>
      </ul>
    </div>

    <div class="footer">
      <p>StorageRedirect Team © 2024</p>
      <p class="thanks">Powered by KernelSU</p>
    </div>
  </div>
</template>

<style scoped>
.about {
  padding-bottom: 80px;
  background-color: #f5f7fa;
  min-height: 100vh;
}

.header-section {
  text-align: center;
  padding: 40px 20px;
}

.logo {
  width: 80px;
  height: 80px;
  margin: 0 auto 20px;
  background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%);
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 32px rgba(139, 92, 246, 0.3);
}

.logo svg {
  width: 40px;
  height: 40px;
  color: #fff;
}

.header-section h1 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #1a1a2e;
}

.version {
  font-size: 14px;
  color: #666;
}

.info-card {
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
  margin-left: 16px;
  margin-right: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.info-card h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #1a1a2e;
}

.feature-list {
  list-style: none;
}

.feature-list li {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.feature-list li:last-child {
  border-bottom: none;
}

.feature-list .icon {
  font-size: 24px;
  flex-shrink: 0;
  color: #8b5cf6;
}

.feature-list strong {
  display: block;
  font-size: 14px;
  margin-bottom: 4px;
  color: #1a1a2e;
}

.feature-list p {
  font-size: 13px;
  color: #666;
  line-height: 1.5;
}

.usage-steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.step {
  display: flex;
  align-items: center;
  gap: 12px;
}

.step-num {
  width: 28px;
  height: 28px;
  background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
  color: #fff;
}

.step p {
  font-size: 14px;
  color: #666;
}

.compat-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.compat-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: #666;
}

.compat-list .check {
  color: #8b5cf6;
  font-weight: bold;
}

.warning-card {
  background: rgba(139, 92, 246, 0.08);
  border-color: rgba(139, 92, 246, 0.15);
}

.warning-card h3 {
  color: #8b5cf6;
}

.warning-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.warning-list li {
  font-size: 13px;
  color: #666;
  padding-left: 16px;
  position: relative;
}

.warning-list li::before {
  content: "•";
  position: absolute;
  left: 0;
  color: #8b5cf6;
}

.footer {
  text-align: center;
  padding: 40px 20px;
  color: #888;
  font-size: 13px;
}

.footer p {
  margin-bottom: 4px;
  color: #666;
}

.footer .thanks {
  font-size: 12px;
  color: #999;
}
</style>
