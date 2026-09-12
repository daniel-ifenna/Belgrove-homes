export default function Footer() {
  return (
    <footer className="bg-stone-800 text-stone-300 mt-24">
      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <h3 className="font-serif text-lg text-white mb-2">Belgrove Homes</h3>
          <p className="text-sm text-stone-400">
            Guiding buyers and sellers through every stage of the property journey since 2025.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-medium text-white mb-2">Contact</h4>
          <p className="text-sm text-stone-400">Suite 25, Lebrex Plaza, 47 Ajose Adeogun Street, Utako, Abuja</p>
          <p className="text-sm text-stone-400">info@belgrovehomes.com</p>
          <p className="text-sm text-stone-400">+234 810 376 0063</p>
        </div>
        <div>
          <h4 className="text-sm font-medium text-white mb-2">Explore</h4>
          <ul className="space-y-1.5 text-sm text-stone-400">
            <li><a href="#gallery" className="hover:text-white transition-colors">Gallery</a></li>
            <li><a href="/vision" className="hover:text-white transition-colors">Vision</a></li>
            <li><a href="/#about" className="hover:text-white transition-colors">About</a></li>
            <li><a href="/book-inspection" className="hover:text-white transition-colors">Book Inspection</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-medium text-white mb-2">Follow</h4>
          <div className="flex gap-4 text-sm text-stone-400">
            <a href="https://www.instagram.com/belgrove_homes?stkn=MTdjZWgyeW9jMWY3Nw==" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Instagram</a>
            <a href="https://www.tiktok.com/@belgrove.homes?_r=1&_t=ZS-99fISorFEkD" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">TikTok</a>
          </div>
        </div>
      </div>
      <div className="border-t border-stone-700 py-4 text-center text-xs text-stone-500">
        &copy; {new Date().getFullYear()} Belgrove Homes. All rights reserved.
      </div>
    </footer>
  );
}
