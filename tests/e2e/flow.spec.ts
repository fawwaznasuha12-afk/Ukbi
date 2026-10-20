import { test, expect, type Page, type Browser } from "@playwright/test";

const PASSWORD = "sandi-uji-123";
const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

async function register(page: Page, email: string) {
  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/Sandi/).fill(PASSWORD);
  await page.getByRole("button", { name: "Daftar", exact: true }).click();
  await page.waitForURL(/\/dashboard$/);
}

test("halaman yang butuh login mengarahkan ke /login", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Masuk" })).toBeVisible();
});

test("alur lengkap: daftar, buat, jawab, refresh, kirim, hasil, analitik", async ({ page }) => {
  await register(page, `user-${uniq()}@uji.test`);

  await page.goto("/practice");
  await page.getByLabel("Latihan Cepat (3 soal)").check();
  await page.getByRole("button", { name: "Buat Sesi Baru" }).click();
  await page.waitForURL(/\/sessions\/[^/]+$/);

  await page.getByRole("button", { name: "Mulai Sesi" }).click();
  await expect(page.getByText("Soal 1 dari 3")).toBeVisible();
  await expect(page.getByRole("timer", { name: "Sisa waktu" })).toBeVisible();

  // Soal pertama bisa pilihan ganda atau esai (urutan acak per sesi).
  const essayBox = page.locator("#essay");
  if (await essayBox.count()) {
    await essayBox.fill("Membaca itu penting. Kosakata bertambah.");
    await essayBox.blur();
    await expect(page.getByText("Tersimpan")).toBeVisible();
    await page.reload();
    await expect(page.locator("#essay")).toHaveValue("Membaca itu penting. Kosakata bertambah.");
  } else {
    await page.getByRole("radio").first().check();
    await expect(page.getByText("Tersimpan")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("radio").first()).toBeChecked();
  }

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Kirim sesi" }).click();
  await page.waitForURL(/\/results\//);
  await expect(page.getByText("Skor akhir latihan")).toBeVisible();
  await expect(page.getByText("Nilai latihan, bukan skor resmi UKBI.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pembahasan" })).toBeVisible();

  await page.goto("/analytics");
  await expect(page.getByRole("heading", { name: "Tren Nilai Latihan" })).toBeVisible();
  await expect(page.locator(".recharts-wrapper").first()).toBeVisible();
});

test("pengguna B tidak bisa membuka sesi pengguna A", async ({ page, browser }: { page: Page; browser: Browser }) => {
  await register(page, `a-${uniq()}@uji.test`);
  await page.goto("/practice");
  await page.getByRole("button", { name: "Buat Sesi Baru" }).click();
  await page.waitForURL(/\/sessions\/[^/]+$/);
  const sessionUrl = new URL(page.url()).pathname;

  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await register(pageB, `b-${uniq()}@uji.test`);
  const res = await pageB.goto(sessionUrl);
  expect(res?.status()).toBe(404);
  await ctxB.close();
});

test("admin bisa menambah soal; pengguna biasa dialihkan dari halaman admin", async ({ page, browser }: { page: Page; browser: Browser }) => {
  const stem = `Soal uji ${uniq()}: manakah kalimat yang baku?`;
  await register(page, "admin@uji.test").catch(async () => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("admin@uji.test");
    await page.getByLabel("Sandi").fill(PASSWORD);
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
  });

  await page.goto("/admin/questions/new");
  await page.locator("select[name=categoryCode]").selectOption("language_rules");
  await page.getByLabel("Jenis soal").selectOption("MULTIPLE_CHOICE");
  await page.getByLabel(/Teks soal/).fill(stem);
  await page.getByLabel(/Pilihan jawaban/).fill("Dia pergi ke pasar.\nDia pergi kepasar.");
  await page.getByLabel(/Kunci jawaban/).fill("A");
  await page.getByLabel("Pembahasan").fill("Kata 'ke' pada tempat ditulis terpisah.");
  await page.getByRole("button", { name: "Simpan soal" }).click();
  await page.waitForURL(/\/admin\/questions$/);
  await expect(page.getByText(stem)).toBeVisible();

  // Duplikat ditolak
  await page.goto("/admin/questions/new");
  await page.getByLabel(/Teks soal/).fill(stem);
  await page.getByLabel(/Pilihan jawaban/).fill("Dia pergi ke pasar.\nDia pergi kepasar.");
  await page.getByLabel(/Kunci jawaban/).fill("A");
  await page.getByLabel("Pembahasan").fill("Pembahasan.");
  await page.getByRole("button", { name: "Simpan soal" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("Duplikat");

  // Pengguna biasa tidak boleh masuk admin
  const ctx = await browser.newContext();
  const p2 = await ctx.newPage();
  await register(p2, `biasa-${uniq()}@uji.test`);
  await p2.goto("/admin/questions");
  await p2.waitForURL(/\/dashboard$/);
  await ctx.close();
});

test("pilih jenjang saat membuat sesi: judul dan daftar sesi menampilkannya", async ({ page }) => {
  await register(page, `jenjang-${uniq()}@uji.test`);
  await page.goto("/practice");
  await page.getByLabel("Latihan Cepat (3 soal)").check();
  await page.locator("select#level").selectOption("KULIAH");
  await page.getByRole("button", { name: "Buat Sesi Baru" }).click();
  await page.waitForURL(/\/sessions\/[^/]+$/);
  await expect(page.getByText("Latihan Cepat Kuliah")).toBeVisible();
  await page.goto("/sessions");
  await expect(page.getByText("Kuliah").first()).toBeVisible();
});

test("sesi mendengarkan memutar audio dan transkrip baru muncul setelah dikirim", async ({ page }) => {
  await register(page, `dengar-${uniq()}@uji.test`);
  await page.goto("/practice");
  await page.getByLabel("Latihan Cepat (3 soal)").check();
  await page.getByLabel("Berdasarkan Kategori").check();
  await page.locator("select#categoryCode").selectOption("listening");
  await page.locator("input#questionCount").fill("2");
  await page.getByRole("button", { name: "Buat Sesi Baru" }).click();
  await page.waitForURL(/\/sessions\/[^/]+$/);
  await page.getByRole("button", { name: "Mulai Sesi" }).click();
  const audio = page.locator("audio").first();
  await expect(audio).toBeVisible();
  await expect(audio).toHaveAttribute("src", /\/audio\/.+\.mp3$/);
  const src = await audio.getAttribute("src");
  const res = await page.request.get(src!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toMatch(/audio|mpeg/);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Kirim sesi" }).click();
  await page.waitForURL(/\/results\//);
  await expect(page.getByText("Transkrip audio:").first()).toBeVisible();
});
