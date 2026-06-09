import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ShoppingCart, Star, Download, FileText, X,
  Coins, ChevronDown, BookOpen,
  CheckCircle, Package, Loader2, AlertCircle,
} from "lucide-react";
import { CATEGORIES, type Category, type Product } from "@/lib/shop-products";
import { useAdmin, useBalance, writeBalance } from "@/lib/admin-store";
import { useTelegramUser } from "@/lib/telegram-user";
import { buyShopProduct } from "@/lib/user-api";

// ── Content generator per category ───────────────────────────────────────────

const BOOK_CONTENT: Record<number, { toc: string[]; body: string }> = {
  1: {
    toc: ["الكتاب الأول: ديون الامتنان","الكتاب الثاني: على نهر الغرانيكوس","الكتاب الثالث: في وحدة العاقل","الكتاب الرابع: في فناء الأشياء","الكتاب الخامس: في الواجب اليومي"],
    body: `<h2>الكتاب الأول — ديون الامتنان</h2>
<p>من جدي فيروس تعلمت الرفق ووقار الطبع.</p>
<p>من أبي — بالسمعة والذكرى — تعلمت الحياء وشجاعة الرجال.</p>
<p>من أمي تعلمت التقوى والكرم، والامتناع ليس فقط عن الأفعال الشريرة بل عن الأفكار الشريرة أيضاً، وتعلمت البساطة في أسلوب الحياة بعيداً عن ثراء الأثرياء.</p>
<p>من جدي الأكبر تعلمت ألا أتردد في الذهاب إلى المدارس العامة، وأن أعتقد أن المعلمين الجيدين تستحق خدمتهم النفقات الكبيرة، وأن أحمل هذا دون شكوى.</p>
<h2>الكتاب الثاني — في وحدة العاقل</h2>
<p>في الفجر حين تستيقظ، كن مستعداً لأن يكون يومك صعباً: ستلتقي بالمتطفلين، والجاحدين، والوقحين، والكذابين، والحاسدين والمعادين للمجتمع.</p>
<p>كل هذه العيوب تنبع من جهلهم بالخير والشر. أما أنا فقد أدركت طبيعة الخير — أنه جميل — وطبيعة الشر — أنه قبيح — وطبيعة الخاطئ نفسه — أنه مرتبط بي، لا بالدم أو بالنسب، بل بالمشاركة في نفس العقل والشرارة الإلهية.</p>
<p>لذلك لا يمكن أن يؤذيني أيٌّ منهم، لأن لا أحد يستطيع أن يجعلني أشارك في ما هو قبيح. كما لا يمكنني أن أغضب من أخي أو أكرهه.</p>
<blockquote>«أخضع قيادي للعقل، لأن العقل هو الطريق إلى الفضيلة.»</blockquote>
<h2>الكتاب الثالث — في فناء الأشياء</h2>
<p>لا تُضيّع ما تبقى من حياتك في التفكير في الآخرين... إلا إذا كان ذلك يخدم مصلحة مشتركة. لأنك إذا انشغلت بما يفكر فيه فلان أو يفعله، تحرم نفسك من عمل آخر.</p>
<p>اصرف ذهنك عن كل ما هو عشوائي وغير ضروري، وفوق كل شيء، عن كل ما يقصد الإضرار أو المديح.</p>`
  },
  2: {
    toc: ["الفصل الأول: التخطيط الاستراتيجي","الفصل الثاني: خوض المعارك","الفصل الثالث: استراتيجية الهجوم","الفصل الرابع: التكتيك","الفصل الخامس: الطاقة"],
    body: `<h2>الفصل الأول — التخطيط الاستراتيجي (始計)</h2>
<p>قال سون تزو: فن الحرب ذو أهمية حيوية للدولة. إنه مسألة حياة أو موت، طريق إلى السلامة أو إلى الخراب. ولذلك فهو موضوع بحث لا يمكن إهماله بأي حال.</p>
<p>يتحكم في فن الحرب خمسة عوامل ثابتة يجب أخذها بعين الاعتبار في تقييراتك حين تسعى لتحديد الظروف السائدة في الميدان:</p>
<ol>
  <li><strong>القانون الأخلاقي</strong> — يجعل الشعب في توافق تام مع حاكمه، حتى يتبعوه دون اعتبار لحياتهم.</li>
  <li><strong>السماء</strong> — تعني الليل والنهار، البرد والحر، الأوقات والفصول.</li>
  <li><strong>الأرض</strong> — تشمل المسافات الكبيرة والصغيرة، الخطر والأمان، الأماكن المفتوحة والضيقة.</li>
  <li><strong>القائد</strong> — يمثل الفضائل الحكمة والصدق والرحمة والشجاعة والصرامة.</li>
  <li><strong>النظام</strong> — يُفهم على أنه تنظيم الجيش، تدرج الضباط، وإدارة الطرق التي يُمدّ بها الجيش.</li>
</ol>
<blockquote>«كل الحروب تقوم على الخداع. لذلك حين قادرون على الهجوم تظاهر بالعجز؛ وحين تستخدم قواتك اجعل العدو يظن أنك خامل.»</blockquote>
<h2>الفصل الثاني — خوض المعارك</h2>
<p>في العمليات الحربية، حين تُشغّل ألف مركبة خفيفة، وعدداً مماثلاً من المركبات الثقيلة، ومئة ألف جندي مسلح، مع إمدادات على مسافة ألف لي، فإن النفقات في الداخل والخارج ستشمل نفقات الضيافة ومواد الصمغ والطلاء والمركبات والأدرع ستبلغ ألف قطعة من الذهب يومياً. هذا هو تكلفة رفع مئة ألف جندي.</p>`
  },
  7: {
    toc: ["المقدمة","القانون الأول: ادخر جزءاً مما تكسب","القانون الثاني: تحكم في إنفاقك","القانون الثالث: اجعل مالك يعمل لك","القانون الرابع: احمِ مالك من الخسارة","القانون الخامس: اجعل مسكنك استثماراً"],
    body: `<h2>أرقش البابلي — أغنى رجل في بابل</h2>
<p>في مدينة بابل القديمة، حيث يقف معبد بيل شامخاً وتزدهر الأسواق، كان أرقش رجلاً حكيماً يعرف أسرار المال.</p>
<p>جاءه يوماً صديقه القديم بنسير قائلاً: "يا أرقش، لماذا أنت غني بينما نحن الذين عملنا معك جميعاً فقراء؟"</p>
<p>ابتسم أرقش وقال: "لأنني تعلمت قانوناً واحداً لم تتعلموه."</p>
<h2>القانون الأول — ادخر جزءاً مما تكسب</h2>
<p>من كل عشرة قطع ذهبية تكسبها، لا تنفق أكثر من تسع. احتفظ بالعاشرة لبناء ثروتك.</p>
<blockquote>«المحفظة تبدأ بالامتلاء متى كنت تضع فيها جزءاً من كسبك، وتبدأ بالفراغ متى أنفقت منها دون أن تردّ ما أخذت.»</blockquote>
<p>قد يبدو هذا بسيطاً، بل تافهاً. لكن دعني أسألك: إذا كنت تعمل عشر سنوات وتكسب ثلاثة آلاف دينار في السنة، أين ذهب الثلاثون ألفاً؟ أين هو الآن؟</p>
<h2>القانون الثاني — تحكم في إنفاقك</h2>
<p>لا تخلط بين رغباتك وضرورياتك. الضروريات قليلة، لكن الرغبات لا نهاية لها.</p>
<p>ضع لنفسك ميزانية: كم تحتاج للطعام؟ للملبس؟ للمسكن؟ للمتعة الضرورية؟ خصص لكل منها مقداراً محدداً ولا تتجاوزه.</p>`
  },
  8: {
    toc: ["الفصل الأول: العقل يشكّل الإنسان","الفصل الثاني: التأثير على النفس","الفصل الثالث: الفكر والغرض","الفصل الرابع: الفكر والعمل","الفصل الخامس: عوامل الإنجاز"],
    body: `<h2>كما يفكر الإنسان — جيمس ألن</h2>
<p>العقل هو العامل المتحكم، يصنع ويُشكّل. والإنسان هو العقل، وهو دائماً يأخذ أداة الفكر ويُشكّل ما يريد، فيُخرج ألف فرحة وألف ألم.</p>
<h2>الفصل الأول — العقل يشكّل الإنسان</h2>
<p>الإنسان هو حرفياً ما يفكر فيه، وشخصيته هي مجموع كل أفكاره.</p>
<p>كما لا يمكن للنبتة أن تنمو دون بذرة، كذلك لا يمكن لأي فعل أن يحدث دون بذرة فكرية مسبقة.</p>
<p>هذا ينطبق على الأفعال الطيبة والسيئة على حد سواء. الشعلة الإلهية تحترق بالتطهير عند كل إنسان، وتتجلى في طريقة تفكيره.</p>
<blockquote>«الإنسان هو سيد أفكاره، ومهندس شخصيته، وصانع بيئته وقدره.»</blockquote>
<h2>الفصل الثاني — التأثير على النفس</h2>
<p>الجسم هو خادم العقل. يطيع العقل — سواء كانت الأفكار المُختارة عن قصد أو تلك التي قُبلت بتهاون وسلبية.</p>
<p>عند أوامر الأفكار غير النظيفة والمخاوف، يتراجع الجسم بسرعة إلى المرض والتدهور.</p>
<p>عند أوامر الأفكار البهيجة وأفكار الجمال، يرتدي الجسم شباباً وجمالاً.</p>`
  },
  3: {
    toc: ["مقدمة: تجربة المعسكر","الجزء الأول: في معسكر الاعتقال","الجزء الثاني: العلاج بالمعنى (Logotherapy)","الجزء الثالث: الحرية في اختيار موقفك","خاتمة: قول نعم للحياة"],
    body: `<h2>الإنسان يبحث عن معنى — فيكتور فرانكل</h2>
<p>دخلت معسكرات الاعتقال النازية وأنا طبيب نفسي أحمل نظريات. خرجت منها إنساناً يعرف الحقيقة بلحمه ودمه.</p>
<h2>الجزء الأول — حياة المعسكر</h2>
<p>حين وصل القطار إلى أوشفيتز، كان كل ما نملكه يُنزع منا — ملابسنا، أسماؤنا، كرامتنا. بقيت أرقاماً. لكن شيئاً واحداً لم يستطيعوا نزعه أبداً: حريتنا في اختيار موقفنا مما يحدث لنا.</p>
<p>لاحظت شيئاً غريباً: الذين نجوا لم يكونوا دائماً الأقوى جسدياً. كانوا من يملكون <em>سبباً</em> للبقاء. من كان لديه معنى ظل يتمسك بالحياة حتى في أقسى الظروف.</p>
<blockquote>«من يملك سبباً للعيش يستطيع تحمّل أي كيف.» — نيتشه</blockquote>
<h2>الجزء الثاني — العلاج بالمعنى</h2>
<p>خلافاً لفرويد الذي يرى أن الإنسان يبحث عن اللذة، وأدلر الذي يرى أنه يبحث عن القوة — أرى أن الإنسان يبحث عن <strong>المعنى</strong>.</p>
<p>المعنى يمكن إيجاده في ثلاثة طرق:</p>
<ol>
  <li><strong>خلق عمل أو إنجاز شيء</strong> — مساهمتك في العالم.</li>
  <li><strong>تجربة شيء أو لقاء شخص</strong> — الحب والجمال والحقيقة.</li>
  <li><strong>الموقف الذي تتخذه من المعاناة الحتمية</strong> — كيف تحمل ألمك.</li>
</ol>
<p>المعسكر علّمني أن المعاناة نفسها لها معنى إذا اخترنا أن نراها كذلك. رجل يحمل صليبه بكرامة يختلف جوهرياً عن رجل يحمله بمرارة.</p>
<h2>الجزء الثالث — الحرية الأخيرة</h2>
<p>يمكن أن تُنزع منك كل شيء إلا شيئاً واحداً: حريتك في اختيار موقفك مما يحدث لك، في اختيار طريقتك في الرد.</p>
<p>بين المحفز والاستجابة توجد مساحة. في تلك المساحة تكمن حريتنا وقدرتنا على النمو.</p>
<blockquote>«في النهاية، الإنسان لا يُسأل عن معنى الحياة — هو من يُسأل. والحياة هي من تطرح الأسئلة. والإنسان يجيب بأفعاله وحياته.»</blockquote>`
  },
  4: {
    toc: ["مقدمة: قوة العقل الباطن","الفصل الأول: كيف يعمل عقلك","الفصل الثاني: التقنية العلاجية","الفصل الثالث: التقنية للثروة","الفصل الرابع: النوم والبرمجة","الفصل الخامس: القانون الذهبي"],
    body: `<h2>قوة العقل الباطن — الدكتور جوزيف ميرفي</h2>
<p>عقلك الباطن لا ينام أبداً. يعمل وأنت نائم، يسمع كل كلمة تقولها لنفسك، ويبني حياتك وفق البرامج التي زرعتها فيه.</p>
<h2>الفصل الأول — العقلان</h2>
<p>تمتلك عقلين يعملان معاً باستمرار:</p>
<ul>
  <li><strong>العقل الواعي</strong> — يفكر، يقرر، يحلل. هو البوّاب.</li>
  <li><strong>العقل الباطن</strong> — يؤمن بكل ما يمرره البوّاب. لا يجادل ولا ينتقد. ينفذ فقط.</li>
</ul>
<p>المشكلة أن معظم الناس يبرمجون عقلهم الباطن بالخوف والشك والحديث السلبي دون أن يدركوا ذلك.</p>
<blockquote>«افرض على عقلك الباطن أفكاراً صحيحة وجميلة ومحبة، وسيتجاوب معك عقلك الباطن بشكل جيد.»</blockquote>
<h2>الفصل الثاني — تقنية البذرة الذهبية</h2>
<p>قبل النوم مباشرة، حين تكون بين اليقظة والنوم، عقلك الباطن في أكثر حالاته قابليةً للاستقبال. في هذه اللحظة:</p>
<ol>
  <li>استرخِ تماماً وأغمض عينيك.</li>
  <li>تخيّل بوضوح الشيء الذي تريده — وظيفة، شفاء، علاقة، مال.</li>
  <li>اشعر بالامتنان كأنه تحقق بالفعل.</li>
  <li>كرر عبارة إيجابية بهدوء: "أنا بصحة ممتازة" أو "أنا مزدهر".</li>
  <li>نم على هذه الصورة.</li>
</ol>
<h2>الفصل الثالث — الثروة والوفرة</h2>
<p>الثروة تبدأ في عقلك الباطن قبل أن تتجلى في بنكك. كل إنسان ثري بدأ بفكرة ثروة راسخة في أعماقه.</p>
<p>إذا كانت لديك قناعة راسخة بالفقر — حتى لو لم تدركها — فستجذب الفقر. والعكس صحيح تماماً.</p>
<blockquote>«عقلك الباطن لا يرى الفرق بين التجربة الحقيقية والتجربة الخيالية الحية. أطعمه المشاعر الصحيحة وهو سيرسم الطريق.»</blockquote>
<h2>القانون الذهبي</h2>
<p>ما تشعر به هو ما تجذبه. ليس ما تفكر فيه فحسب — بل ما تشعر به بعمق. العقل الباطن يستجيب للمشاعر أكثر من الكلمات.</p>`
  },
  5: {
    toc: ["مقدمة: روح الجماهير","الفصل الأول: خصائص العقل الجماعي","الفصل الثاني: عوامل تشكيل الجماهير","الفصل الثالث: القائد والجماهير","الفصل الرابع: التصنيفات والأصناف"],
    body: `<h2>سيكولوجيا الجماهير — غوستاف لوبون</h2>
<p>حين يجتمع الأفراد في جماهير، يخضعون لقانون وحدة العقل الجماعي. يتوقفون عن كونهم أفراداً ويصبحون كياناً واحداً له خصائصه الخاصة — وهذه الخصائص مختلفة جوهرياً عن خصائص كل فرد على حدة.</p>
<h2>الفصل الأول — خصائص العقل الجماعي</h2>
<p>الجمهور يختلف عن مجموع أفراده في ثلاثة جوانب جوهرية:</p>
<ol>
  <li><strong>الغياب المؤقت للشخصية الفردية</strong> — يذوب الفرد في الكتلة ويفقد إحساسه بمسؤوليته الشخصية.</li>
  <li><strong>العدوى</strong> — المشاعر والأفكار تنتقل في الجمهور كالعدوى. فكرة واحدة تسيطر على الجميع في لحظات.</li>
  <li><strong>القابلية للإيحاء</strong> — الجمهور قابل للإيحاء للدرجة القصوى. يقبل الادعاءات الأكثر خيالاً كحقائق.</li>
</ol>
<blockquote>«الجمهور لا يعرف الشك ولا اليقين — هو متطرف في كل شيء.»</blockquote>
<h2>الفصل الثاني — كيف تصنع الجماهير قادتها</h2>
<p>القائد الفعّال للجماهير لا يتوجه لعقولهم — بل يتوجه لمشاعرهم. يستخدم التأكيد بدلاً من الحجة، والتكرار بدلاً من المنطق، والعدوى بدلاً من الإقناع.</p>
<p>لا تحتاج الأفكار لأن تكون صحيحة لتنتشر في الجماهير — تحتاج فقط لأن تكون بسيطة، قوية، وعاطفية.</p>
<h2>الفصل الثالث — الجماهير في التاريخ</h2>
<p>كل الثورات الكبرى، الحروب، والتحولات الاجتماعية صنعتها الجماهير — لا الأفراد. لكن الأفراد الذين فهموا سيكولوجيا الجماهير هم من استطاعوا توجيهها.</p>
<blockquote>«الحضارة مستحيلة بدون تقاليد راسخة، والتقدم مستحيل دون تدمير تلك التقاليد. الصعوبة في الموازنة بينهما.»</blockquote>`
  },
  6: {
    toc: ["المقدمة: السر","المبدأ الأول: الرغبة","المبدأ الثاني: الإيمان","المبدأ الثالث: الإيحاء الذاتي","المبدأ الرابع: المعرفة المتخصصة","المبدأ الخامس: الخيال","المبادئ الباقية للثروة"],
    body: `<h2>فكر وازدد ثروة — نابليون هيل</h2>
<p>درست خمسمئة من أنجح الأمريكيين على مدى عشرين عاماً بطلب من أندرو كارنيجي. ما وجدته ليس سراً — إنه قانون طبيعي مثل قانون الجاذبية.</p>
<h2>المبدأ الأول — الرغبة: نقطة البداية لكل إنجاز</h2>
<p>الرغبة ليست تمنياً — الرغبة هي حالة عقلية ملتهبة، مركّزة، لا تقبل الفشل. هيرنان كورتيس حين وصل إلى المكسيك أمر بحرق سفنه لئلا يكون للرجال خيار غير النصر.</p>
<p><strong>الخطوات الست لتحويل الرغبة لذهب:</strong></p>
<ol>
  <li>حدد المبلغ المحدد الذي تريده — لا "الكثير"، بل رقم دقيق.</li>
  <li>حدد ما ستقدمه مقابل هذا المال.</li>
  <li>حدد تاريخاً محدداً لتحقيق هدفك.</li>
  <li>ضع خطة مفصلة وابدأ تنفيذها فوراً حتى لو لم تكن مستعداً.</li>
  <li>اكتب بيانك: المبلغ، الموعد، الثمن، والخطة.</li>
  <li>اقرأ بيانك بصوت عالٍ مرتين يومياً — صباحاً ومساءً.</li>
</ol>
<blockquote>«كل إنجاز، وكل ثروة مكتسبة، بدأت بفكرة.»</blockquote>
<h2>المبدأ الثاني — الإيمان</h2>
<p>الإيمان هو الرأس المال الوحيد الذي لا يمكن لأي بنك أن يضمنه — وهو العملة الوحيدة التي يقبلها الكون.</p>
<p>الإيمان حالة ذهنية يمكن تطويرها بالتأكيد والتكرار. حين تكرر فكرة لعقلك الباطن مرات كافية، يصبح يؤمن بها ويبني عليها.</p>
<h2>المبدأ الثالث — الإيحاء الذاتي</h2>
<p>لا يمكن لأي فكرة خارجية أن تؤثر فيك إلا إذا سمحت لها بذلك من خلال أفكارك الخاصة. أنت البوّاب الوحيد لعقلك الباطن.</p>
<blockquote>«الفرق الوحيد بين الناجح والفاشل في أغلب الأحيان هو القدرة على التحمل حتى اللحظة الأخيرة.»</blockquote>
<h2>المبدأ الخامس — الخيال</h2>
<p>كل الإنجازات البشرية وُلدت أولاً في مخيلة إنسان. المصنع، الطائرة، الهاتف — كلها بدأت أفكاراً. خيالك هو المصنع الذي تُشكَّل فيه كل مخططات الإنجاز البشري.</p>`
  },
};

function getTOC(p: Product): string[] {
  if (p.toc && p.toc.length > 0) return p.toc;
  if (BOOK_CONTENT[p.id]) return BOOK_CONTENT[p.id].toc;
  const cat = p.category;
  if (cat === "📚 كتب مترجمة") return [
    "مقدمة المترجم", "الفصل الأول: البداية", "الفصل الثاني: التطور",
    "الفصل الثالث: الذروة", "الفصل الرابع: الخاتمة", "ملاحظات وتعليقات",
  ];
  if (cat === "🎓 كورسات") return [
    "مقدمة الكورس وأهدافه", "الوحدة الأولى: الأساسيات", "الوحدة الثانية: المفاهيم المتوسطة",
    "الوحدة الثالثة: التطبيق العملي", "الوحدة الرابعة: المشاريع", "الوحدة الخامسة: الاحتراف",
    "تمارين ومسائل محلولة", "موارد إضافية",
  ];
  if (cat === "📐 قوالب") return [
    "دليل الاستخدام", "القالب الرئيسي", "نماذج مكتملة", "تخصيص القالب", "أمثلة تطبيقية",
  ];
  if (cat === "💻 برمجة") return [
    "المقدمة والمتطلبات", "المفاهيم الأساسية", "الهياكل والخوارزميات",
    "التطبيق العملي", "أنماط التصميم", "التحسين والأداء", "مسائل وحلول",
  ];
  return [
    "المقدمة", "الفصل الأول", "الفصل الثاني", "الفصل الثالث",
    "التطبيق العملي", "الخلاصة والموارد",
  ];
}

function getBody(p: Product): string {
  if (p.body && p.body.trim()) return p.body;
  if (BOOK_CONTENT[p.id]) return BOOK_CONTENT[p.id].body;
  const cat = p.category;

  if (cat === "🎓 كورسات") return `
<h2>مقدمة الكورس</h2>
<p>مرحباً بك في <strong>${p.titleAr}</strong>. هذا الكورس مصمم خصيصاً ليأخذك من مستوى المبتدئ إلى الاحتراف الكامل خلال ${Math.ceil(p.pages / 30)} أسابيع من الدراسة المنتظمة.</p>
<h2>الوحدة الأولى — الأساسيات</h2>
<p>${p.desc}</p>
<p>قبل أن نبدأ، دعنا نفهم لماذا هذا المجال مهم جداً اليوم:</p>
<ul>
  <li>الطلب العالمي في سوق العمل يتضاعف سنوياً.</li>
  <li>يمكنك العمل من أي مكان في العالم.</li>
  <li>الدخل المتوسط في هذا المجال أعلى بكثير من المجالات التقليدية.</li>
</ul>
<h3>المفاهيم الأساسية التي ستتعلمها:</h3>
<ol>
  <li><strong>المفهوم الأول</strong> — الأساس النظري والخلفية العلمية.</li>
  <li><strong>المفهوم الثاني</strong> — التطبيق العملي في البيئات الحقيقية.</li>
  <li><strong>المفهوم الثالث</strong> — ربط كل شيء في مشاريع متكاملة.</li>
</ol>
<h2>الوحدة الثانية — التطبيق العملي</h2>
<p>في هذه الوحدة سنطبق كل ما تعلمناه في مشاريع حقيقية. ستخرج بـ <strong>3 مشاريع احترافية</strong> تضيفها لملفك الشخصي.</p>
<h3>تمرين عملي:</h3>
<p>ابدأ بحل المسألة التالية قبل الانتقال للوحدة التالية — هذا يضمن أنك فهمت المحتوى بعمق.</p>
<blockquote>«الخبرة هي المعلم الحقيقي. كل مشروع تبنيه يساوي عشرة كتب قرأتها.»</blockquote>`;

  if (cat === "📐 قوالب") return `
<h2>دليل الاستخدام</h2>
<p>هذا القالب جاهز للاستخدام الفوري. اتبع الخطوات التالية:</p>
<ol>
  <li>افتح الملف في التطبيق المناسب (Word / Excel / Figma / Notion).</li>
  <li>استبدل النصوص الموجودة بمعلوماتك الخاصة.</li>
  <li>قم بتخصيص الألوان والخطوط لتناسب هويتك البصرية.</li>
  <li>احفظ نسخة باسمك قبل التعديل للرجوع إليها.</li>
</ol>
<h2>${p.titleAr}</h2>
<p>${p.desc}</p>
<h2>هيكل القالب</h2>
<table style="width:100%;border-collapse:collapse;margin:1rem 0">
  <tr style="background:rgba(255,255,255,0.1)"><th style="padding:0.5rem;border:1px solid rgba(255,255,255,0.2)">القسم</th><th style="padding:0.5rem;border:1px solid rgba(255,255,255,0.2)">الوصف</th><th style="padding:0.5rem;border:1px solid rgba(255,255,255,0.2)">الحجم</th></tr>
  <tr><td style="padding:0.5rem;border:1px solid rgba(255,255,255,0.1)">الغلاف</td><td style="padding:0.5rem;border:1px solid rgba(255,255,255,0.1)">العنوان والبيانات الرئيسية</td><td style="padding:0.5rem;border:1px solid rgba(255,255,255,0.1)">1 صفحة</td></tr>
  <tr><td style="padding:0.5rem;border:1px solid rgba(255,255,255,0.1)">المحتوى الرئيسي</td><td style="padding:0.5rem;border:1px solid rgba(255,255,255,0.1)">المحتوى التفصيلي المطلوب</td><td style="padding:0.5rem;border:1px solid rgba(255,255,255,0.1)">${Math.floor(p.pages * 0.8)} صفحة</td></tr>
  <tr><td style="padding:0.5rem;border:1px solid rgba(255,255,255,0.1)">الملاحق</td><td style="padding:0.5rem;border:1px solid rgba(255,255,255,0.1)">جداول وأدوات إضافية</td><td style="padding:0.5rem;border:1px solid rgba(255,255,255,0.1)">${Math.floor(p.pages * 0.2)} صفحة</td></tr>
</table>
<blockquote>«نصيحة: لا تعدّل القالب الأصلي مباشرة — احفظ نسخة أولاً.»</blockquote>`;

  if (cat === "💻 برمجة") return `
<h2>مقدمة</h2>
<p>${p.desc}</p>
<h2>المفاهيم الأساسية</h2>
<p>قبل الغوص في التفاصيل، يجب فهم المبادئ الجوهرية التي يقوم عليها هذا المجال:</p>
<div style="background:rgba(0,0,0,0.4);border:1px solid rgba(56,189,248,0.3);border-radius:12px;padding:1rem;font-family:monospace;direction:ltr;text-align:left;margin:1rem 0;font-size:0.85rem;">
<span style="color:#94a3b8"># مثال على الكود الأساسي</span><br/>
<span style="color:#38bdf8">def</span> <span style="color:#e2e8f0">main</span>():<br/>
&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#34d399">print</span>(<span style="color:#f59e0b">"مرحباً بك في ${p.title}"</span>)<br/>
&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#94a3b8"># ابدأ رحلتك هنا</span><br/>
&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#94a3b8">pass</span><br/><br/>
<span style="color:#38bdf8">if</span> __name__ == <span style="color:#f59e0b">"__main__"</span>:<br/>
&nbsp;&nbsp;&nbsp;&nbsp;main()
</div>
<h2>الفصل الأول — الأساسيات</h2>
<p>نبدأ بالمفاهيم الأساسية التي يجب إتقانها قبل الانتقال لأي مستوى أعلى:</p>
<ul>
  <li>المفهوم الأساسي الأول وكيف يعمل في الواقع.</li>
  <li>الأخطاء الشائعة التي يقع فيها المبتدئون وكيف تتجنبها.</li>
  <li>أفضل الممارسات المعتمدة في الصناعة.</li>
</ul>
<blockquote>«الكود الجيد هو الكود الذي يفهمه إنسان، وليس فقط الكود الذي ينفذه حاسوب.»</blockquote>`;

  if (cat === "🤖 ذكاء اصطناعي") return `
<h2>مقدمة في ${p.titleAr}</h2>
<p>${p.desc}</p>
<h2>كيف تعمل نماذج الذكاء الاصطناعي؟</h2>
<p>نماذج اللغة الكبيرة (LLMs) مثل GPT و Claude و Gemini تعمل بآلية الـ Transformer التي تحلل العلاقات بين الكلمات في سياق واسع.</p>
<div style="background:rgba(0,0,0,0.4);border:1px solid rgba(167,139,250,0.3);border-radius:12px;padding:1rem;font-family:monospace;direction:ltr;text-align:left;margin:1rem 0;font-size:0.8rem;">
<span style="color:#a78bfa">System:</span> <span style="color:#e2e8f0">You are a helpful assistant.</span><br/><br/>
<span style="color:#34d399">User:</span> <span style="color:#e2e8f0">Summarize this in 3 bullets:</span><br/>
<span style="color:#e2e8f0">[your content here]</span><br/><br/>
<span style="color:#f59e0b">Assistant:</span> <span style="color:#94a3b8">• First key point...</span><br/>
<span style="color:#94a3b8">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;• Second key point...</span><br/>
<span style="color:#94a3b8">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;• Third key point...</span>
</div>
<h2>أبرز تقنيات البرومبت</h2>
<ul>
  <li><strong>Zero-Shot</strong> — طرح السؤال مباشرة دون أمثلة.</li>
  <li><strong>Few-Shot</strong> — تقديم 2-3 أمثلة قبل السؤال لتوجيه الإجابة.</li>
  <li><strong>Chain-of-Thought</strong> — طلب التفكير خطوة بخطوة للمسائل المعقدة.</li>
  <li><strong>Role Prompting</strong> — تعيين دور محدد للنموذج قبل طرح السؤال.</li>
</ul>
<blockquote>«جودة إخراجك تساوي جودة مدخلاتك. برومبت واضح = إجابة رائعة.»</blockquote>`;

  if (cat === "📊 مالية") return `
<h2>${p.titleAr}</h2>
<p>${p.desc}</p>
<h2>المبادئ المالية الأساسية</h2>
<p>قبل أي استثمار، هناك ثلاث قواعد ذهبية يجب حفظها:</p>
<ol>
  <li><strong>قاعدة الطوارئ:</strong> احتفظ دائماً بـ 3-6 أشهر من مصاريفك سائلة قبل أي استثمار.</li>
  <li><strong>قاعدة 50/30/20:</strong> 50% للضروريات، 30% للرغبات، 20% للادخار والاستثمار.</li>
  <li><strong>قاعدة المخاطر:</strong> لا تستثمر مالاً لا تتحمل خسارته.</li>
</ol>
<h2>جدول التخطيط المالي</h2>
<table style="width:100%;border-collapse:collapse;margin:1rem 0">
  <tr style="background:rgba(74,222,128,0.15)"><th style="padding:0.6rem;border:1px solid rgba(74,222,128,0.3)">البند</th><th style="padding:0.6rem;border:1px solid rgba(74,222,128,0.3)">النسبة المثالية</th><th style="padding:0.6rem;border:1px solid rgba(74,222,128,0.3)">مثال (10,000 ريال)</th></tr>
  <tr><td style="padding:0.5rem;border:1px solid rgba(255,255,255,0.1)">الضروريات</td><td style="padding:0.5rem;border:1px solid rgba(255,255,255,0.1)">50%</td><td style="padding:0.5rem;border:1px solid rgba(255,255,255,0.1)">5,000</td></tr>
  <tr><td style="padding:0.5rem;border:1px solid rgba(255,255,255,0.1)">الرغبات</td><td style="padding:0.5rem;border:1px solid rgba(255,255,255,0.1)">30%</td><td style="padding:0.5rem;border:1px solid rgba(255,255,255,0.1)">3,000</td></tr>
  <tr><td style="padding:0.5rem;border:1px solid rgba(255,255,255,0.1)">الاستثمار</td><td style="padding:0.5rem;border:1px solid rgba(255,255,255,0.1)">20%</td><td style="padding:0.5rem;border:1px solid rgba(255,255,255,0.1)">2,000</td></tr>
</table>
<blockquote>«أفضل وقت لبدء الاستثمار كان منذ 20 عاماً. أفضل وقت ثانٍ هو الآن.»</blockquote>`;

  if (cat === "🎨 تصميم") return `
<h2>${p.titleAr}</h2>
<p>${p.desc}</p>
<h2>المبادئ الأساسية للتصميم</h2>
<p>كل تصميم احترافي يقوم على ستة مبادئ لا غنى عنها:</p>
<ol>
  <li><strong>التوازن (Balance)</strong> — توزيع العناصر البصرية بطريقة تخلق شعوراً بالاستقرار.</li>
  <li><strong>التباين (Contrast)</strong> — الاختلاف بين العناصر لجذب الانتباه وإنشاء تسلسل بصري.</li>
  <li><strong>التكرار (Repetition)</strong> — تكرار العناصر البصرية يخلق الوحدة والاتساق.</li>
  <li><strong>المحاذاة (Alignment)</strong> — ربط العناصر ببعضها بصرياً ينظّم المساحة.</li>
  <li><strong>القرب (Proximity)</strong> — تجميع العناصر المتعلقة يوضح علاقتها ببعضها.</li>
  <li><strong>الفضاء الأبيض (White Space)</strong> — المساحة الفارغة ليست فارغة بل تتنفس.</li>
</ol>
<blockquote>«التصميم الجيد واضح. التصميم الرائع غير مرئي.»</blockquote>`;

  // Business
  return `
<h2>${p.titleAr}</h2>
<p>${p.desc}</p>
<h2>الإطار العام</h2>
<p>يستخدم هذا الدليل منهجية مثبتة تعتمد على ثلاث مراحل رئيسية:</p>
<ol>
  <li><strong>التشخيص</strong> — فهم الوضع الحالي بدقة قبل اتخاذ أي خطوة.</li>
  <li><strong>التخطيط</strong> — بناء خارطة طريق واضحة قابلة للقياس.</li>
  <li><strong>التنفيذ</strong> — التطبيق الفعلي مع مراقبة مستمرة وتعديل دوري.</li>
</ol>
<blockquote>«الاستراتيجية بدون تنفيذ وهم. والتنفيذ بدون استراتيجية كابوس.»</blockquote>
<h2>الأدوات والأطر العملية</h2>
<p>في الصفحات التالية ستجد أدوات عملية جاهزة للتطبيق الفوري في مجالك.</p>`;
}

// ── HTML document builder ─────────────────────────────────────────────────────

function buildHtmlContent(p: Product): string {
  const ac = CAT_COLOR[p.category] ?? "#d4af37";
  const toc = getTOC(p);
  const body = getBody(p);
  const stars = "★".repeat(Math.round(p.rating)) + "☆".repeat(5 - Math.round(p.rating));
  const date = new Date().toLocaleDateString("ar-EG", { year:"numeric", month:"long", day:"numeric" });

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${p.titleAr}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;900&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Tajawal',sans-serif;background:#07050f;color:#e2e8f0;min-height:100vh;direction:rtl}
  .cover{min-height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:3rem 2rem;background:radial-gradient(ellipse at center, ${ac}18 0%, transparent 70%);border-bottom:1px solid ${ac}30;position:relative}
  .cover::before{content:'';position:absolute;inset:0;background:url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><circle cx="30" cy="30" r="1" fill="${encodeURIComponent(ac)}" opacity="0.15"/></svg>') repeat;pointer-events:none}
  .badge{display:inline-block;background:${ac}22;border:1px solid ${ac}55;color:${ac};font-size:.75rem;font-weight:700;padding:.3rem .8rem;border-radius:999px;letter-spacing:.05em;margin-bottom:1.5rem}
  .cover h1{font-size:clamp(1.8rem,6vw,3rem);font-weight:900;color:#fff;line-height:1.2;margin-bottom:.5rem;max-width:700px}
  .cover .sub{font-size:1rem;color:rgba(255,255,255,.45);font-style:italic;margin-bottom:2rem}
  .meta-row{display:flex;flex-wrap:wrap;gap:1rem;justify-content:center;margin-bottom:2rem}
  .meta-chip{display:flex;align-items:center;gap:.4rem;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:.35rem .9rem;font-size:.8rem;color:rgba(255,255,255,.6)}
  .stars{color:#f59e0b;letter-spacing:.1em}
  .skz-brand{font-size:.75rem;color:rgba(255,255,255,.2);border-top:1px solid rgba(255,255,255,.08);padding-top:1.5rem;margin-top:1.5rem;width:100%;text-align:center}
  .skz-brand strong{color:${ac}}
  main{max-width:780px;margin:0 auto;padding:3rem 1.5rem 6rem}
  .toc{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:1.5rem 2rem;margin-bottom:3rem}
  .toc h3{font-size:1rem;font-weight:700;color:${ac};margin-bottom:1rem;display:flex;align-items:center;gap:.5rem}
  .toc ol{padding-right:1.2rem}
  .toc li{padding:.3rem 0;color:rgba(255,255,255,.65);font-size:.9rem;border-bottom:1px solid rgba(255,255,255,.05)}
  .toc li:last-child{border:none}
  .content h2{font-size:1.35rem;font-weight:700;color:#fff;margin:2.5rem 0 1rem;padding-bottom:.5rem;border-bottom:1px solid ${ac}40;position:relative}
  .content h2::before{content:'';position:absolute;bottom:-1px;right:0;width:3rem;height:2px;background:${ac}}
  .content h3{font-size:1.05rem;font-weight:600;color:${ac};margin:1.5rem 0 .7rem}
  .content p{margin-bottom:1rem;color:rgba(255,255,255,.78);line-height:1.9;font-size:.95rem}
  .content ul,.content ol{margin:.5rem 0 1rem 1.5rem;color:rgba(255,255,255,.72);line-height:1.8;font-size:.95rem}
  .content li{margin-bottom:.35rem}
  .content blockquote{border-right:3px solid ${ac};padding:1rem 1.2rem;margin:1.5rem 0;background:${ac}10;border-radius:0 12px 12px 0;color:rgba(255,255,255,.85);font-style:italic;font-size:1rem}
  .content table{width:100%;border-collapse:collapse;margin:1rem 0;font-size:.88rem}
  .chapter-num{font-size:.75rem;color:${ac};font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:.3rem;display:block}
  .preview-notice{margin-top:4rem;padding:1.5rem;background:${ac}12;border:1px solid ${ac}35;border-radius:16px;text-align:center}
  .preview-notice p{color:rgba(255,255,255,.55);font-size:.85rem;margin:0}
  .preview-notice strong{color:${ac}}
</style>
</head>
<body>
<div class="cover">
  <div class="badge">${p.category}</div>
  <h1>${p.titleAr}</h1>
  <div class="sub">${p.title}</div>
  <div class="meta-row">
    <div class="meta-chip"><span class="stars">${stars}</span>${p.rating}/5</div>
    <div class="meta-chip">📄 ${p.pages} صفحة</div>
    <div class="meta-chip">⬇ ${p.downloads.toLocaleString()} تحميل</div>
    <div class="meta-chip">💰 ${p.price} SKZ</div>
  </div>
  <div class="skz-brand">
    مكتسب من <strong>SKZ BOT Marketplace</strong> · ${date}
  </div>
</div>

<main>
  <div class="toc">
    <h3>📋 فهرس المحتويات</h3>
    <ol>${toc.map(t => `<li>${t}</li>`).join("")}</ol>
  </div>

  <div class="content">
    ${body}
    <div class="preview-notice">
      <p>هذا الملف عرض تقديمي من <strong>${p.titleAr}</strong>.<br/>
      النسخة الكاملة (<strong>${p.pages} صفحة</strong>) متاحة عبر منصة SKZ BOT.</p>
    </div>
  </div>
</main>
</body>
</html>`;
}

function triggerDownload(p: Product) {
  const html = buildHtmlContent(p);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${p.titleAr.replace(/[^\u0600-\u06FFa-z0-9 ]/gi, "").trim().slice(0, 40)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Download Overlay (portal) ────────────────────────────────────────────────

function DownloadOverlay({ product, onDone }: { product: Product; onDone: () => void }) {
  const ac = accent(product.category);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const started = useRef(false);

  // Animate progress then trigger real download
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let p = 0;
    const id = setInterval(() => {
      p += Math.random() * 18 + 8;
      if (p >= 100) {
        clearInterval(id);
        triggerDownload(product);
        setProgress(100);
        setDone(true);
        setTimeout(onDone, 1400);
      } else {
        setProgress(Math.min(p, 99));
      }
    }, 120);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overlay = (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center px-6"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(10px)" }}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.88, opacity: 0 }}
        className="w-full max-w-[340px] rounded-3xl border p-6 flex flex-col items-center gap-4"
        style={{ background: "#0e0b18", borderColor: `${ac}35` }}
      >
        {/* Icon */}
        <motion.div
          animate={done ? { scale: [1, 1.2, 1] } : { rotate: [0, 360] }}
          transition={done ? { duration: 0.4 } : { repeat: Infinity, duration: 1.4, ease: "linear" }}
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: `${ac}20`, border: `2px solid ${ac}50` }}
        >
          {done
            ? <CheckCircle size={32} className="text-green-400" />
            : <Download size={28} style={{ color: ac }} />
          }
        </motion.div>

        {/* Text */}
        <div className="text-center">
          <div className="font-display font-black text-base text-white mb-0.5">
            {done ? "تم التحميل! ✓" : "جاري التحميل…"}
          </div>
          <div className="text-xs text-white/40 font-display line-clamp-1">{product.titleAr}</div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 rounded-full bg-white/8 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${ac}, ${ac}88)`, boxShadow: `0 0 8px ${ac}88` }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.15 }}
          />
        </div>
        <div className="text-[11px] text-white/30 font-display font-bold -mt-2">
          {Math.round(progress)}%
        </div>

        {/* File info */}
        <div className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/5 border border-white/8">
          <FileText size={16} className="text-white/30 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-white/60 font-display truncate">
              SKZ_{product.id}_{product.title.slice(0, 20)}…txt
            </div>
            <div className="text-[10px] text-white/25 font-display">{product.pages} صفحة · ملف نصي</div>
          </div>
          <div className="text-[10px] text-white/25 font-display shrink-0">
            {Math.round(product.pages * 2.4)} KB
          </div>
        </div>
      </motion.div>
    </motion.div>
  );

  return createPortal(overlay, document.body);
}

const BALANCE_KEY  = "skz_balance";
const LIBRARY_KEY  = "skz_library";

function getLibrary(): number[] {
  try { return JSON.parse(localStorage.getItem(LIBRARY_KEY) || "[]"); } catch { return []; }
}
function addToLibrary(id: number) {
  const lib = getLibrary();
  if (!lib.includes(id)) localStorage.setItem(LIBRARY_KEY, JSON.stringify([...lib, id]));
}

// ── Visual helpers ──────────────────────────────────────────────────────────

const BADGE_STYLE: Record<string, string> = {
  BESTSELLER: "bg-yellow-400/20 text-yellow-300 border-yellow-400/40",
  HOT:        "bg-red-500/20 text-red-300 border-red-500/40",
  NEW:        "bg-green-500/20 text-green-300 border-green-500/40",
  TOP:        "bg-purple-500/20 text-purple-300 border-purple-500/40",
  FREE:       "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
};
const CAT_COLOR: Record<string, string> = {
  "📚 كتب مترجمة":      "#f59e0b",
  "🎓 كورسات":          "#818cf8",
  "📐 قوالب":           "#34d399",
  "💻 برمجة":           "#38bdf8",
  "🎨 تصميم":           "#f472b6",
  "💼 أعمال":           "#fb923c",
  "🤖 ذكاء اصطناعي":   "#a78bfa",
  "📊 مالية":           "#4ade80",
};
const accent = (cat: string) => CAT_COLOR[cat] ?? "#d4af37";

type SortKey = "popular" | "newest" | "price_asc" | "price_desc" | "rating";
const SORT_LABELS: Record<SortKey, string> = {
  popular:    "الأكثر تحميلاً",
  newest:     "الأحدث",
  price_asc:  "السعر: من الأقل",
  price_desc: "السعر: من الأعلى",
  rating:     "الأعلى تقييماً",
};

function formatK(n: number) { return n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n); }

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={9}
          className={i <= Math.round(rating) ? "text-yellow-400 fill-yellow-400" : "text-white/15 fill-white/15"} />
      ))}
      <span className="text-[10px] text-white/40 ml-0.5 font-display">{rating.toFixed(1)}</span>
    </div>
  );
}

// ── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({ product, owned, onOpen }: { product: Product; owned: boolean; onOpen: (p: Product) => void }) {
  const ac = accent(product.category);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.93 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.93 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onOpen(product)}
      className="flex flex-col rounded-2xl overflow-hidden border border-white/8 bg-white/4 cursor-pointer group"
    >
      {/* Image */}
      <div className="relative overflow-hidden" style={{ aspectRatio: "4/3" }}>
        <img
          src={product.image} alt={product.titleAr}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
        {/* PDF tag */}
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur px-1.5 py-0.5 rounded-md">
          <FileText size={9} className="text-white/70" />
          <span className="text-[9px] text-white/70 font-display font-bold">PDF · {product.pages}p</span>
        </div>
        {/* Badge */}
        {product.badge && !owned && (
          <div className={`absolute top-2 right-2 text-[9px] font-display font-black px-1.5 py-0.5 rounded-md border ${BADGE_STYLE[product.badge]}`}>
            {product.badge}
          </div>
        )}
        {/* Owned check */}
        {owned && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-green-500/80 backdrop-blur px-1.5 py-0.5 rounded-md">
            <CheckCircle size={9} className="text-white" />
            <span className="text-[9px] text-white font-display font-bold">مملوك</span>
          </div>
        )}
        {/* Downloads */}
        <div className="absolute bottom-2 right-2 flex items-center gap-0.5 bg-black/50 backdrop-blur px-1.5 py-0.5 rounded-md">
          <Download size={9} className="text-white/60" />
          <span className="text-[9px] text-white/60 font-display">{formatK(product.downloads)}</span>
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1.5 p-2.5 flex-1">
        <div className="text-[10px] font-display font-bold tracking-wide truncate" style={{ color: ac }}>
          {product.category}
        </div>
        <h3 className="text-xs font-display font-bold text-white leading-tight line-clamp-2 min-h-[30px]">
          {product.titleAr}
        </h3>
        <Stars rating={product.rating} />
        <div className="flex items-center justify-between mt-auto pt-1 border-t border-white/6">
          {owned ? (
            <div className="flex items-center gap-1 text-green-400 text-[10px] font-display font-bold">
              <Download size={11} /> تحميل
            </div>
          ) : (
            <div className="flex items-baseline gap-0.5">
              <Coins size={11} className="text-yellow-400 shrink-0" />
              <span className="font-display font-black text-sm text-yellow-300">{product.price}</span>
              <span className="text-[10px] text-white/30 font-display">SKZ</span>
            </div>
          )}
          <div className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: owned ? "#16a34a30" : `${ac}25`, border: `1px solid ${owned ? "#16a34a50" : `${ac}40`}` }}>
            {owned ? <Download size={12} className="text-green-400" /> : <ShoppingCart size={12} style={{ color: ac }} />}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Product Modal (rendered via Portal to escape overflow:hidden) ─────────────

function ProductModal({ product, owned: initOwned, balance: initBalance, balanceLoading, onClose, onBuy }: {
  product: Product; owned: boolean; balance: number; balanceLoading?: boolean;
  onClose: () => void; onBuy: (p: Product) => void;
}) {
  const [bought, setBought] = useState(initOwned);
  const [bal, setBal] = useState(initBalance);
  const [buyLoading, setBuyLoading] = useState(false);
  const [buyError, setBuyError] = useState("");
  const ac = accent(product.category);
  const canAfford = !balanceLoading && bal >= product.price;

  async function handleBuy() {
    if (bought || !canAfford || buyLoading) return;
    setBuyLoading(true);
    setBuyError("");
    try {
      const result = await buyShopProduct(product.id);
      if (!result.ok) {
        setBuyError(result.error ?? "فشل الشراء");
        return;
      }
      const newBal = result.newSkz ?? bal - product.price;
      writeBalance(newBal);
      setBal(newBal);
      addToLibrary(product.id);
      setBought(true);
      onBuy(product);
    } catch {
      setBuyError("خطأ في الاتصال — حاول مجدداً");
    } finally {
      setBuyLoading(false);
    }
  }

  const modal = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-end justify-center px-3 pb-4"
      style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 340 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[430px] rounded-3xl border overflow-hidden flex flex-col"
        style={{ background: "#0e0b18", borderColor: `${ac}35`, maxHeight: "88vh" }}
      >
        {/* Hero image */}
        <div className="relative shrink-0" style={{ height: 160 }}>
          <img src={product.image} alt={product.titleAr} className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, #0e0b18 100%)` }} />
          <button onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/10">
            <X size={17} className="text-white/80" />
          </button>
          {product.badge && !bought && (
            <div className={`absolute top-3 left-3 text-[10px] font-display font-black px-2 py-0.5 rounded-full border ${BADGE_STYLE[product.badge]}`}>
              {product.badge}
            </div>
          )}
          {bought && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-green-500/80 backdrop-blur px-2.5 py-1 rounded-full">
              <CheckCircle size={11} className="text-white" />
              <span className="text-[11px] text-white font-display font-bold">في مكتبتك</span>
            </div>
          )}
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 pb-5 pt-1" style={{ WebkitOverflowScrolling: "touch" }}>
          {/* Category + Titles */}
          <div className="text-[10px] font-display font-bold tracking-widest mb-1 mt-2" style={{ color: ac }}>
            {product.category}
          </div>
          <h2 className="font-display font-black text-xl text-white leading-tight">{product.titleAr}</h2>
          <p className="text-[11px] text-white/35 font-display mt-0.5 mb-3 italic">{product.title}</p>

          {/* Stats */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Stars rating={product.rating} />
            <div className="flex items-center gap-1 text-[10px] text-white/40 font-display">
              <Download size={10} />{formatK(product.downloads)} تحميل
            </div>
            <div className="flex items-center gap-1 text-[10px] text-white/40 font-display">
              <FileText size={10} />{product.pages} صفحة PDF
            </div>
          </div>

          {/* Description */}
          <div className="px-4 py-3 rounded-2xl border border-white/8 bg-white/4 mb-4">
            <p className="text-sm text-white/75 leading-relaxed">{product.desc}</p>
          </div>

          {/* Features list */}
          <div className="flex flex-col gap-2 mb-5">
            {[
              ["📥", "تحميل فوري بعد الشراء"],
              ["🔒", "ملف PDF عالي الجودة"],
              ["🔄", "تحديثات مستقبلية مجانية"],
              ["✅", "محتوى مرخص قانونياً للبيع والتوزيع"],
              ["📱", "يعمل على جميع الأجهزة والتطبيقات"],
            ].map(([icon, text]) => (
              <div key={text} className="flex items-center gap-2.5">
                <span className="text-base w-5 text-center">{icon}</span>
                <span className="text-xs text-white/55 font-display">{text}</span>
              </div>
            ))}
          </div>

          {/* Price + CTA */}
          <div className="rounded-2xl border p-4 flex flex-col gap-3" style={{ borderColor: `${ac}30`, background: `${ac}0a` }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] text-white/30 font-display mb-0.5">السعر</div>
                <div className="flex items-baseline gap-1">
                  <Coins size={16} className="text-yellow-400" />
                  <span className="font-display font-black text-2xl text-yellow-300">{product.price}</span>
                  <span className="text-sm text-white/30 font-display">SKZ</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-white/30 font-display mb-0.5">رصيدك</div>
                <div className="font-display font-bold text-base text-white">{bal} SKZ</div>
              </div>
            </div>

            {bought ? (
              <div className="w-full py-3.5 rounded-2xl bg-green-500/20 border border-green-500/40 flex items-center justify-center gap-2">
                <CheckCircle size={16} className="text-green-400" />
                <span className="font-display font-black text-sm text-green-300">تم الشراء — في مكتبتك!</span>
              </div>
            ) : (
              <>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleBuy}
                  disabled={!canAfford || buyLoading}
                  className="w-full py-3.5 rounded-2xl font-display font-black text-sm tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-35"
                  style={{ background: `linear-gradient(135deg, ${ac}, ${ac}99)`, color: "#000", boxShadow: canAfford ? `0 0 24px ${ac}44` : "none" }}
                >
                  {buyLoading
                    ? <Loader2 size={16} className="animate-spin" />
                    : <><ShoppingCart size={16} />شراء مقابل {product.price} SKZ</>
                  }
                </motion.button>
                {buyError && (
                  <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl">
                    <AlertCircle size={13} />{buyError}
                  </div>
                )}
                {!canAfford && !buyError && (
                  <div className="text-center text-[11px] text-red-400/70 font-display">
                    تحتاج {product.price - bal} SKZ إضافية للشراء
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );

  return createPortal(modal, document.body);
}

// ── My Library Panel ──────────────────────────────────────────────────────────

function LibraryPanel({ library }: { library: number[] }) {
  const { products } = useAdmin();
  const owned = useMemo(() => products.filter(p => library.includes(p.id)), [library, products]);
  const [downloading, setDownloading] = useState<Product | null>(null);

  if (owned.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center">
          <BookOpen size={32} className="text-white/20" />
        </div>
        <div className="text-center">
          <div className="font-display font-black text-lg text-white/40">مكتبتك فارغة</div>
          <div className="text-xs text-white/25 font-display mt-1">اشترِ منتجاً لتراه هنا فوراً</div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-28">
      {/* Stats bar */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/4 border border-white/8">
        <Package size={18} className="text-yellow-400 shrink-0" />
        <div>
          <div className="text-sm font-display font-black text-white">{owned.length} منتج مكتسب</div>
          <div className="text-[10px] text-white/30 font-display">
            إجمالي: {owned.reduce((s, p) => s + p.price, 0).toLocaleString()} SKZ
          </div>
        </div>
        <div className="ml-auto text-[11px] text-white/30 font-display">{owned.reduce((s, p) => s + p.pages, 0)} صفحة</div>
      </div>

      {/* Library items */}
      {owned.map((p, i) => {
        const ac = accent(p.category);
        return (
          <motion.div key={p.id}
            initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
            className="flex items-center gap-3 p-3 rounded-2xl border border-white/8 bg-white/4">
            {/* Thumbnail */}
            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-white/10">
              <img src={p.image} alt={p.titleAr} className="w-full h-full object-cover" />
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-display font-bold mb-0.5" style={{ color: ac }}>{p.category}</div>
              <div className="text-sm font-display font-bold text-white leading-tight line-clamp-2">{p.titleAr}</div>
              <div className="flex items-center gap-2 mt-1">
                <Stars rating={p.rating} />
                <span className="text-[10px] text-white/30 font-display">· {p.pages}p PDF</span>
              </div>
            </div>
            {/* Download btn */}
            <button
              onClick={() => setDownloading(p)}
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-all active:scale-90"
              style={{ background: `${ac}20`, borderColor: `${ac}40` }}>
              <Download size={15} style={{ color: ac }} />
            </button>
          </motion.div>
        );
      })}

      {/* Download progress overlay */}
      <AnimatePresence>
        {downloading && (
          <DownloadOverlay
            key={downloading.id}
            product={downloading}
            onDone={() => setDownloading(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Shop Component ───────────────────────────────────────────────────────

export default function Shop() {
  const [tab, setTab] = useState<"store" | "library">("store");
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("popular");
  const [showSort, setShowSort] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const balance = useBalance();
  const [library, setLibrary] = useState<number[]>(() => getLibrary());
  const { products, settings } = useAdmin();
  const { loading: balanceLoading } = useTelegramUser();

  const handleBuy = useCallback((_p: Product) => {
    setLibrary(getLibrary());
  }, []);

  const filtered = useMemo(() => {
    let list = products;
    if (activeCategory !== "All") list = list.filter(p => p.category === activeCategory);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p =>
        p.titleAr.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }
    switch (sort) {
      case "popular":    return [...list].sort((a, b) => b.downloads - a.downloads);
      case "newest":     return [...list].sort((a, b) => b.id - a.id);
      case "price_asc":  return [...list].sort((a, b) => a.price - b.price);
      case "price_desc": return [...list].sort((a, b) => b.price - a.price);
      case "rating":     return [...list].sort((a, b) => b.rating - a.rating);
      default:           return list;
    }
  }, [activeCategory, search, sort, products]);

  if (!settings.shopEnabled) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center">
          <Package size={32} className="text-white/20" />
        </div>
        <div>
          <div className="font-display font-black text-lg text-white/50">المتجر مغلق مؤقتاً</div>
          <div className="text-xs text-white/30 font-display mt-1">سيعود قريباً — تابعنا</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      {/* ── Header ── */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-2xl font-display font-black text-white tracking-wider uppercase">Marketplace</h1>
            <p className="text-xs text-white/40 mt-0.5 font-display">
              {products.length > 0 ? `${products.length} منتج رقمي · مرخص للبيع والتحميل` : "لا توجد منتجات حالياً"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5 bg-yellow-400/10 border border-yellow-400/30 px-2.5 py-1 rounded-full">
              <Coins size={11} className="text-yellow-400" />
              {balanceLoading ? (
                <div className="h-3 w-14 rounded bg-white/10 animate-pulse" />
              ) : (
                <span className="text-[11px] text-yellow-300 font-display font-bold">{balance} SKZ</span>
              )}
            </div>
            {library.length > 0 && (
              <button onClick={() => setTab("library")}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/25">
                <Package size={10} className="text-green-400" />
                <span className="text-[10px] text-green-400 font-display">{library.length} منتج</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Switch */}
        <div className="flex items-center gap-0 mt-3 rounded-2xl border border-white/10 bg-white/4 p-1">
          {([["store","🛒 السوق"], ["library","📚 مكتبتي"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 py-2 rounded-xl text-xs font-display font-bold transition-all flex items-center justify-center gap-1.5 ${tab === key ? "bg-yellow-400/15 text-yellow-300 border border-yellow-400/30" : "text-white/40"}`}>
              {label}
              {key === "library" && library.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-yellow-400/20 text-yellow-300 text-[9px] font-display font-black flex items-center justify-center">
                  {library.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Library Tab ── */}
      <AnimatePresence mode="wait">
        {tab === "library" && (
          <motion.div key="lib" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            <LibraryPanel library={library} />
          </motion.div>
        )}

        {/* ── Store Tab ── */}
        {tab === "store" && (
          <motion.div key="store" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>

            {/* Search + Sort */}
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="ابحث عن كتاب، كورس، قالب..."
                  className="w-full pl-9 pr-8 py-2.5 rounded-2xl bg-white/6 border border-white/10 text-white text-xs font-display placeholder:text-white/25 focus:outline-none focus:border-white/25"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X size={12} className="text-white/30" />
                  </button>
                )}
              </div>
              {/* Sort */}
              <div className="relative">
                <button onClick={() => setShowSort(v => !v)}
                  className="flex items-center gap-1 px-3 py-2.5 rounded-2xl bg-white/6 border border-white/10 text-white/50 text-[11px] font-display whitespace-nowrap">
                  <ChevronDown size={12} />{SORT_LABELS[sort].split(":")[0]}
                </button>
                <AnimatePresence>
                  {showSort && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                      className="absolute top-full right-0 mt-1 z-40 rounded-2xl border border-white/10 overflow-hidden min-w-[160px] shadow-2xl"
                      style={{ background: "#13101f" }}>
                      {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
                        <button key={k} onClick={() => { setSort(k); setShowSort(false); }}
                          className={`w-full text-right px-4 py-2.5 text-xs font-display transition-colors hover:bg-white/8 ${sort === k ? "text-yellow-300 bg-yellow-400/10" : "text-white/60"}`}>
                          {SORT_LABELS[k]}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3" style={{ scrollbarWidth: "none" }}>
              {CATEGORIES.map(cat => {
                const count = cat === "All" ? products.length : products.filter(p => p.category === cat).length;
                const color = cat === "All" ? "#d4af37" : (CAT_COLOR[cat] ?? "#d4af37");
                const active = activeCategory === cat;
                return (
                  <button key={cat} onClick={() => setActiveCategory(cat)}
                    className="flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-full text-[11px] font-display font-bold transition-all shrink-0 border"
                    style={active
                      ? { background: `${color}25`, borderColor: `${color}60`, color }
                      : { background: "transparent", borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" }}>
                    {cat === "All" ? "🌐 الكل" : cat}
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-display"
                      style={active ? { background: `${color}30`, color } : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)" }}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Results count */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] text-white/30 font-display">
                {filtered.length} نتيجة{search ? ` لـ "${search}"` : ""}
              </span>
              {activeCategory !== "All" && (
                <button onClick={() => setActiveCategory("All")}
                  className="text-[11px] text-white/30 font-display flex items-center gap-1">
                  <X size={10} />إلغاء الفلتر
                </button>
              )}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 gap-2.5 pb-28">
              <AnimatePresence mode="popLayout">
                {filtered.map(p => (
                  <ProductCard key={p.id} product={p} owned={library.includes(p.id)} onOpen={setSelected} />
                ))}
              </AnimatePresence>
              {filtered.length === 0 && products.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="col-span-2 text-center py-16 text-white/30 font-display">
                  <div className="text-4xl mb-3">🛍️</div>
                  <div className="text-sm font-bold">لا توجد منتجات بعد</div>
                  <div className="text-xs mt-1 opacity-60">تابعنا لمعرفة آخر العروض</div>
                </motion.div>
              )}
              {filtered.length === 0 && products.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="col-span-2 text-center py-16 text-white/30 font-display">
                  <div className="text-4xl mb-3">🔍</div>
                  <div className="text-sm font-bold">لا توجد نتائج</div>
                  <div className="text-xs mt-1 opacity-60">جرّب بحثاً مختلفاً</div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Product Modal via Portal ── */}
      <AnimatePresence>
        {selected && (
          <ProductModal
            key={selected.id}
            product={selected}
            owned={library.includes(selected.id)}
            balance={balance}
            balanceLoading={balanceLoading}
            onClose={() => setSelected(null)}
            onBuy={handleBuy}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
