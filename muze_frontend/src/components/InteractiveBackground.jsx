import React, { useEffect, useRef } from 'react';

const InteractiveBackground = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particles (acoustic nodes & musical shapes)
    const particleCount = Math.min(50, Math.floor((width * height) / 2000));
    const particles = [];
    const musicSymbols = ['♩', '♪', '♫', '♬', '◎', '◈'];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 2 + 1.5,
        symbol: Math.random() > 0.6 ? musicSymbols[Math.floor(Math.random() * musicSymbols.length)] : null,
        symbolSize: Math.random() * 18 + 12,
        opacity: Math.random() * 0.3 + 0.1
      });
    }

    // Ripples triggered on click
    const ripples = [];

    const handleClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Spawn a soundwave ripple
      ripples.push({
        x,
        y,
        radius: 5,
        maxRadius: Math.random() * 90 + 120,
        opacity: 0.6,
        growth: 2.5
      });

      // Give nearby particles a gentle nudge
      particles.forEach((p) => {
        const dx = p.x - x;
        const dy = p.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 180 && dist > 0) {
          const force = (180 - dist) / 180;
          p.vx += (dx / dist) * force * 1.5;
          p.vy += (dy / dist) * force * 1.5;
        }
      });
    };

    window.addEventListener('click', handleClick);

    // Track mouse position for soft interaction
    let mouse = { x: -1000, y: -1000 };
    const handleMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Main render loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Draw and update ripples
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.radius += r.growth;
        r.opacity -= 0.009;

        if (r.opacity <= 0 || r.radius >= r.maxRadius) {
          ripples.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(16, 185, 129, ${r.opacity * 0.4})`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 6]);
        ctx.stroke();

        // Inner harmonic ring
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius * 0.6, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(99, 102, 241, ${r.opacity * 0.25})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }

      // 2. Draw moving dotted connection lines between close particles
      const maxConnectDist = 130;
      ctx.setLineDash([2, 5]);
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxConnectDist) {
            const alpha = (1 - dist / maxConnectDist) * 0.12;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(16, 185, 129, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
      ctx.setLineDash([]); // Reset line dash

      // 3. Draw particles & floating music symbols
      particles.forEach((p) => {
        // Move particle
        p.x += p.vx;
        p.y += p.vy;

        // Friction to return to peaceful drift
        p.vx *= 0.985;
        p.vy *= 0.985;

        // Ensure minimum slow drift
        if (Math.abs(p.vx) < 0.15) p.vx += (Math.random() - 0.5) * 0.05;
        if (Math.abs(p.vy) < 0.15) p.vy += (Math.random() - 0.5) * 0.05;

        // Bounce gently at screen edges
        if (p.x < 0) { p.x = 0; p.vx *= -1; }
        if (p.x > width) { p.x = width; p.vx *= -1; }
        if (p.y < 0) { p.y = 0; p.vy *= -1; }
        if (p.y > height) { p.y = height; p.vy *= -1; }

        // Distance to mouse for slight glow
        const mdx = p.x - mouse.x;
        const mdy = p.y - mouse.y;
        const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
        const mouseHover = mDist < 120;

        ctx.save();
        if (p.symbol) {
          // Floating Music Symbol
          ctx.font = `${p.symbolSize}px serif`;
          ctx.fillStyle = mouseHover
            ? `rgba(52, 211, 153, 0.45)`
            : `rgba(148, 163, 184, ${p.opacity * 0.75})`;
          ctx.fillText(p.symbol, p.x, p.y);
        } else {
          // Circular Acoustic Vector Dot
          ctx.beginPath();
          ctx.arc(p.x, p.y, mouseHover ? p.radius * 1.5 : p.radius, 0, Math.PI * 2);
          ctx.fillStyle = mouseHover
            ? `rgba(52, 211, 153, 0.5)`
            : `rgba(99, 102, 241, ${p.opacity * 0.8})`;
          ctx.fill();
        }
        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.9 }}
    />
  );
};

export default InteractiveBackground;
