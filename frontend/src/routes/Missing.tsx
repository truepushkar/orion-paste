import { Link } from 'react-router-dom'
import styles from './Missing.module.css'
import atoms from '../styles/atoms.module.css'
import { Shell } from '../components/Shell'

/** A 404 is a place, not an error dialog. It says what happened, then offers
 *  the one action that helps. */
export function Missing() {
  return (
    <Shell
      status={
        <>
          <span>404</span>
          <span aria-hidden="true">/</span>
          <span>nothing stored here</span>
        </>
      }
    >
      <div className={styles.wrap}>
        <div className={styles.panel}>
          <h1 className={styles.headline}>There is nothing at this address</h1>
          <p className={styles.note}>
            Either the link was mistyped, or the entry reached the end of its
            retention and was deleted. Stow does not keep expired entries.
          </p>
          <div className={styles.actions}>
            <Link to="/" className={`${atoms.button} ${atoms.buttonPrimary}`}>
              Write a new entry
            </Link>
            <Link to="/about" className={atoms.button}>
              How Stow works
            </Link>
          </div>
        </div>
      </div>
    </Shell>
  )
}
