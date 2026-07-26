export default function AuthCard({ children }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background:
          'radial-gradient(ellipse at 20% 0%, #4a2b4f 0%, #3d2340 45%, #26152a 100%)',
      }}
    >
      <div className="bg-paper rounded-[22px] max-w-[400px] w-full p-9 shadow-2xl">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8.5 h-8.5 w-[34px] h-[34px] rounded-full bg-gradient-to-br from-peach to-gold flex items-center justify-center text-plumdeep text-base">
            ❤
          </div>
          <span className="font-serif text-2xl font-semibold">iLove</span>
        </div>
        <div className="text-[11px] tracking-[2px] uppercase text-peach/90 ml-[46px] mb-5">
          a companion for two
        </div>
        {children}
      </div>
    </div>
  )
}
