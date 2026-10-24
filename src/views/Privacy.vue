<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

function goBack() {
  if (window.history.state && window.history.state.back) router.back()
  else router.replace('/')
}
</script>

<template>
  <div>
    <header class="nav-bar">
      <button class="nav-back" aria-label="返回" @click="goBack">
        <svg viewBox="0 0 12 20" aria-hidden="true">
          <path d="M10.6 1.6 2 10l8.6 8.4" fill="none" stroke="currentColor" stroke-width="2.2"
            stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>返回</span>
      </button>
      <div class="nav-title">隐私政策</div>
    </header>

    <div class="large-title">
      <h1>隐私政策</h1>
      <div class="sub">生效日期：2026 年 10 月 24 日</div>
    </div>

    <div class="group">
      <div class="md">
        <h3>一、说明</h3>
        <p>「CQPUE资助政策」（以下简称"本应用"）由周泽维个人独立开发，是一款面向重庆工程职业技术大学学生的<strong>公益、免费</strong>政策查询工具，仅用于学习与研究目的，<strong>不作任何商业用途</strong>。</p>
        <p>本应用<strong>没有账号体系、没有登录、没有支付、没有广告、没有内购</strong>，也不含任何收费项目。我们不出售、不出租、不以任何形式交易任何数据。</p>

        <h3>二、开发者与联系方式</h3>
        <p>开发者：周泽维（个人开发者，非学校官方）</p>
        <p>联系电话：15736152295</p>
        <p>如对本政策或个人信息处理有任何疑问、意见或投诉，可通过上述电话联系，我们将在 15 个工作日内答复。</p>

        <h3>三、我们收集哪些信息</h3>
        <p><strong>本应用不收集、不上传、不存储任何个人信息。</strong></p>
        <p>具体而言：不获取姓名、学号、身份证号、手机号、位置、通讯录、相册、设备标识符（IMEI / OAID / Android ID）、剪贴板内容；不进行用户画像、行为统计或广告投放；不接入任何第三方统计、推送、广告或崩溃上报 SDK。</p>

        <h3>四、权限说明</h3>
        <p>本应用声明的系统权限：</p>
        <ul>
          <li><strong>网络访问（INTERNET）</strong>：为 Android WebView 组件的运行环境所需。应用代码中没有任何网络请求，所有政策内容均随安装包内置，断网可正常使用。</li>
          <li><strong>内部广播权限</strong>：由 AndroidX 组件自动生成，仅限应用内部使用。</li>
        </ul>
        <p>本应用<strong>不申请</strong>相机、麦克风、通讯录、位置、短信、通话记录、存储读写等任何敏感权限。</p>

        <h3>五、本地存储</h3>
        <p>为改善使用体验，应用会在您手机本地保存以下数据，<strong>仅存于本机，不会上传</strong>：</p>
        <ul>
          <li>材料清单的勾选状态</li>
          <li>最近一次的搜索关键词</li>
          <li>字号偏好设置</li>
        </ul>
        <p>您可以在应用内"材料清单－清空"或清除应用数据、卸载应用，随时删除上述全部内容。</p>

        <h3>六、分享功能</h3>
        <p>点击分享时，应用会调用 Android 系统的分享面板，由您自行选择目标应用（如微信、QQ）。分享内容为当前页面的政策标题与说明，<strong>由您主动发起</strong>；我们不记录分享行为，也无法获知分享对象。</p>

        <h3>七、信息的共享、转让与公开披露</h3>
        <p>由于本应用不收集个人信息，因此<strong>不存在</strong>向任何第三方共享、转让、公开披露个人信息的情形。法律法规另有强制性规定的除外。</p>

        <h3>八、未成年人保护</h3>
        <p>本应用面向高校在校学生。若使用者为未满 18 周岁的未成年人，请在监护人指导下使用。本应用不针对未成年人单独收集任何信息。</p>

        <h3>九、您的权利</h3>
        <p>依据《中华人民共和国个人信息保护法》，您对个人信息享有知情、决定、查阅、复制、更正、删除等权利。由于本应用不收集个人信息，上述权利主要体现为：卸载应用或清除应用数据即可彻底删除全部本地记录。</p>

        <h3>十、政策更新</h3>
        <p>本政策如发生变更，将在应用内本页面更新并标注生效日期；涉及重大变更时，会在应用首页显著位置提示。</p>

        <h3>十一、内容来源与免责</h3>
        <p>本应用内容依据学校及国家、重庆市公开的资助政策文件整理，<strong>非学校官方发布</strong>。政策可能随年度调整，具体条件、金额与办理时间<strong>以学校学生资助管理中心当年通知为准</strong>。本应用不构成任何政策承诺或法律依据。</p>

        <h3>十二、生效</h3>
        <p>本政策自 2026 年 10 月 24 日起生效。</p>
      </div>
    </div>

    <div class="group-footer">本应用完全免费，无广告、无内购、无付费服务。</div>
    <div class="push-bottom"></div>
  </div>
</template>
