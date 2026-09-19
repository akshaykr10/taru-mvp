import { Link } from 'react-router-dom'

/* Polymorphic wrapper around the shared `.btn` classes (landing.css) —
   renders a Link when `to` is given, an <a> when `href` is given,
   otherwise a <button>. All other props pass straight through. */
export default function Button({ variant = 'primary', to, href, className = '', children, ...rest }) {
  const classes = ['btn', variant, className].filter(Boolean).join(' ')

  if (to) {
    return <Link to={to} className={classes} {...rest}>{children}</Link>
  }
  if (href) {
    return <a href={href} className={classes} {...rest}>{children}</a>
  }
  return <button className={classes} {...rest}>{children}</button>
}
