import { testimonials } from "@/lib/content";

export default function TestimonialsPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-20">
      <p className="uppercase tracking-widest text-stone-400 text-xs mb-4">Testimonials</p>
      <h1 className="font-serif text-3xl md:text-4xl text-stone-800 mb-12">
        Stories from our clients
      </h1>

      <div className="grid md:grid-cols-2 gap-8">
        {testimonials.map((t) => (
          <blockquote key={t.name} className="bg-white p-6 rounded-lg border border-stone-200">
            <p className="text-stone-600 mb-4">&ldquo;{t.quote}&rdquo;</p>
            <footer className="text-sm text-stone-800 font-medium">
              {t.name} <span className="text-stone-400 font-normal"> {t.role}</span>
            </footer>
          </blockquote>
        ))}
      </div>
    </div>
  );
}
